'use strict';
// Połączenia między urządzeniami: telefon (pilot) ↔ duży ekran (telewizor, rzutnik, drugi komputer).
// Moduł przeniesiony z gry Songster (ten sam autor) – ten sam sposób łączenia.
// Trzy kanały, ten sam 4-znakowy kod pokoju:
// 1) własny serwer pośredniczący (Cloudflare Workers, jak server/relay w Songsterze) po WebSocket (port 443) – działa w każdej
//    sieci, także komórkowej, z małym opóźnieniem; używany, gdy ustawiony jest jego adres (RELAY_URL),
// 2) bezpośrednio przez WebRTC (PeerJS) – bywa blokowane przez sieć (zwłaszcza komórkową) albo przeglądarkę (np. Brave),
// 3) zapasowo przez publiczny serwer MQTT po WebSocket – działa w każdej sieci, ale jest wspólny i wolniejszy.
// Gospodarz pokoju słucha na wszystkich; dołączający próbuje najpierw własnego serwera, a gdy się nie uda – WebRTC i MQTT.
// Biblioteki ładujemy dopiero, gdy ktoś z tego korzysta.
(function () {
  const PEERJS = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
  const MQTTJS = 'https://cdnjs.cloudflare.com/ajax/libs/mqtt/5.10.1/mqtt.min.js';
  const QRLIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  // publiczny serwer shiftr.io (konto „public”) – kanały są jawne, dlatego przesyłamy wyłącznie stan gry
  const MQTT_URL = 'wss://public.cloud.shiftr.io';
  const MQTT_AUTH = { username: 'public', password: 'public' };
  // adres własnego serwera pośredniczącego (Cloudflare Workers); pusty – kanał wyłączony (zostają WebRTC i MQTT)
  const RELAY_URL = window.KRAG_RELAY || '';
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bez łatwych do pomylenia znaków (0/O, 1/I/L)
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => { delete loaded[src]; reject(new Error('script')); };
        document.head.append(s);
      });
    }
    return loaded[src];
  }
  const rand = (n) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  const peerId = (kind, code) => `kragobfitosci-${kind}-${code.toUpperCase()}`;
  const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what || 'timeout')), ms))]);

  // połączenie przez serwer pośredniczący – ten sam interfejs co połączenie PeerJS (send, on('data'|'close'), open)
  function makeConn(send, onLocalClose) {
    const ev = { data: [], close: [] };
    const queue = [];
    const conn = {
      open: true, via: 'mqtt', seen: Date.now(),
      send: (msg) => { if (conn.open) send(msg); },
      on: (name, fn) => {
        (ev[name] || (ev[name] = [])).push(fn);
        if (name === 'data') while (queue.length) fn(queue.shift());
        return conn;
      },
      // zamknięcie z tej strony – druga strona dostaje wiadomość „bye”
      close: () => { if (conn.open && onLocalClose) onLocalClose(); conn._close(); },
      _data: (msg) => { if (ev.data.length) ev.data.forEach((f) => f(msg)); else queue.push(msg); },
      _close: () => { if (!conn.open) return; conn.open = false; ev.close.forEach((f) => f()); },
    };
    return conn;
  }
  let mqttClientP = null;
  function mqttClient() {
    if (!mqttClientP) {
      mqttClientP = loadScript(MQTTJS).then(() => new Promise((resolve, reject) => {
        const c = window.mqtt.connect(MQTT_URL, { ...MQTT_AUTH, clientId: 'krag-' + rand(10), reconnectPeriod: 2000, connectTimeout: 10000 });
        // po krótkim zerwaniu MQTT.js łączy się ponownie sam (reconnectPeriod) i odnawia subskrypcje (resubscribe – domyślnie
        // włączone); gdy klient zostanie zamknięty na dobre, następne połączenie tworzy nowego klienta
        c.once('connect', () => resolve(c));
        c.once('error', (e) => { mqttClientP = null; reject(e); });
        c.on('end', () => { mqttClientP = null; });
      }));
    }
    return mqttClientP;
  }
  const topicBase = (kind, code) => `kragobfitosci/v1/${kind}/${code}`;

  async function mqttHost(kind, code, onConn) {
    const c = await withTimeout(mqttClient(), 12000, 'mqtt');
    const base = topicBase(kind, code);
    const conns = new Map();
    c.subscribe(base + '/up');
    const onMsg = (topic, payload) => {
      if (topic !== base + '/up') return;
      let m;
      try { m = JSON.parse(payload.toString()); } catch (e) { return; }
      if (!m || !m.from) return;
      let conn = conns.get(m.from);
      if (m.bye) { if (conn) { conn._close(); conns.delete(m.from); } return; }
      if (!conn) {
        const down = `${base}/d/${m.from}`;
        conn = makeConn((msg) => c.publish(down, JSON.stringify(msg)), () => { c.publish(down, JSON.stringify({ __bye: true })); conns.delete(m.from); });
        conns.set(m.from, conn);
        onConn(conn);
      }
      conn.seen = Date.now();
      if (m.msg) conn._data(m.msg);
    };
    c.on('message', onMsg);
    // urządzenie, które przez 35 s nic nie wysłało (także sygnału obecności), uznajemy za rozłączone
    const timer = setInterval(() => {
      for (const [id, conn] of conns) if (Date.now() - conn.seen > 35000) { conn._close(); conns.delete(id); }
    }, 5000);
    // zamknięcie pokoju: wszyscy dołączeni dostają „bye”
    return () => {
      clearInterval(timer);
      for (const conn of [...conns.values()]) conn.close();
      conns.clear();
      c.removeListener('message', onMsg);
      c.unsubscribe(base + '/up');
    };
  }
  async function mqttConnect(kind, code) {
    const c = await withTimeout(mqttClient(), 12000, 'mqtt');
    const base = topicBase(kind, code);
    const me = rand(10);
    const mine = `${base}/d/${me}`;
    let ping = null;
    const bye = () => c.publish(base + '/up', JSON.stringify({ from: me, bye: true }));
    const onHide = () => bye();
    const cleanup = () => {
      clearInterval(ping);
      c.removeListener('message', onMsg);
      c.unsubscribe(mine);
      window.removeEventListener('pagehide', onHide);
    };
    const conn = makeConn((msg) => c.publish(base + '/up', JSON.stringify({ from: me, msg })), bye);
    conn.on('close', cleanup);
    let answered;
    const firstReply = new Promise((resolve) => { answered = resolve; });
    function onMsg(topic, payload) {
      if (topic !== mine) return;
      let m;
      try { m = JSON.parse(payload.toString()); } catch (e) { return; }
      answered();
      if (m && m.__bye) { conn._close(); return; }
      conn._data(m);
    }
    c.subscribe(mine);
    c.on('message', onMsg);
    c.publish(base + '/up', JSON.stringify({ from: me, msg: { probe: true } }));
    ping = setInterval(() => c.publish(base + '/up', JSON.stringify({ from: me, ping: true })), 10000);
    window.addEventListener('pagehide', onHide);
    try {
      await withTimeout(firstReply, 9000, 'no-host');
    } catch (e) {
      conn.open = false;
      cleanup();
      throw e;
    }
    return { conn };
  }
  // ---------- własny serwer pośredniczący (server/relay) ----------
  const relayRoom = (kind, code) => `${RELAY_URL.replace(/\/+$/, '')}/room/${kind}-${code}`;
  // otwarcie WebSocketu i pierwsza wiadomość serwera ({t: 'ok'} albo powód odmowy)
  function wsOpen(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        ws.onmessage = null;
        if (m.t === 'ok') resolve(ws); else { reject(new Error(m.t || 'relay')); try { ws.close(); } catch (err) { /* zamknięte */ } }
      };
      ws.onerror = () => reject(new Error('relay'));
      ws.onclose = () => reject(new Error('relay'));
    });
  }
  // podtrzymanie połączenia: „ping” – serwer odpowiada sam, bez budzenia pokoju
  const keepAlive = (ws) => setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 25000);
  async function wsHost(kind, code, onConn) {
    const conns = new Map();
    let ws = null;
    let ping = null;
    let closed = false;
    const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
    const connFor = (id) => {
      let conn = conns.get(id);
      if (!conn) {
        conn = makeConn((msg) => send({ to: id, d: msg }), () => { send({ to: id, close: true }); conns.delete(id); });
        conn.via = 'ws';
        conns.set(id, conn);
        onConn(conn);
      }
      return conn;
    };
    const attach = (sock) => {
      ws = sock;
      clearInterval(ping);
      ping = keepAlive(sock);
      sock.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'join') { connFor(m.id); return; }
        if (m.t === 'leave') { const c = conns.get(m.id); if (c) { c._close(); conns.delete(m.id); } return; }
        if (m.from) { const c = connFor(m.from); c.seen = Date.now(); c._data(m.d); }
      };
      // zerwane połączenie gospodarza: serwer rozłączył graczy (połączą się ponownie) – wracamy do tego samego pokoju
      sock.onclose = () => {
        clearInterval(ping);
        for (const c of conns.values()) c._close();
        conns.clear();
        if (closed) return;
        setTimeout(function again() {
          if (closed) return;
          wsOpen(relayRoom(kind, code) + '?role=host').then(attach, () => setTimeout(again, 3000));
        }, 1000);
      };
    };
    try {
      attach(await withTimeout(wsOpen(relayRoom(kind, code) + '?role=host'), 8000, 'relay'));
    } catch (e) {
      if (e.message === 'taken') return 'taken';
      throw e;
    }
    return () => {
      closed = true;
      for (const conn of [...conns.values()]) { try { conn.send({ __bye: true }); } catch (e) { /* zerwane */ } conn._close(); }
      conns.clear();
      clearInterval(ping);
      setTimeout(() => { try { ws.close(); } catch (e) { /* zamknięte */ } }, 300);
    };
  }
  async function wsConnect(kind, code) {
    const ws = await withTimeout(wsOpen(`${relayRoom(kind, code)}?role=peer&id=${rand(10)}`), 6000, 'relay');
    const ping = keepAlive(ws);
    const conn = makeConn((msg) => { if (ws.readyState === 1) ws.send(JSON.stringify({ d: msg })); }, () => {});
    conn.via = 'ws';
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'bye') { conn._close(); return; }
      if ('d' in m) { if (m.d && m.d.__bye) { conn._close(); return; } conn._data(m.d); }
    };
    ws.onclose = () => { clearInterval(ping); conn._close(); };
    conn.on('close', () => { clearInterval(ping); try { ws.close(); } catch (e) { /* zamknięte */ } });
    return { conn };
  }

  async function peerHost(kind, code, onConn) {
    await loadScript(PEERJS);
    const peer = new window.Peer(peerId(kind, code));
    const ok = await withTimeout(new Promise((resolve) => {
      peer.on('open', () => resolve(true));
      peer.on('error', (e) => resolve(e && e.type === 'unavailable-id' ? 'taken' : false));
    }), 10000, 'peer').catch(() => false);
    if (ok !== true) { peer.destroy(); return ok; }
    const conns = new Set();
    peer.on('connection', (conn) => conn.on('open', () => {
      conns.add(conn);
      conn.on('close', () => conns.delete(conn));
      onConn(conn);
    }));
    // serwer pośredniczący zrywa bezczynne połączenie – wracamy z tym samym kodem
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    return () => {
      for (const conn of conns) { try { conn.send({ __bye: true }); } catch (e) { /* zerwane */ } }
      // chwila na dostarczenie „bye”, potem zamykamy
      setTimeout(() => peer.destroy(), 300);
    };
  }
  async function peerConnect(kind, code) {
    await loadScript(PEERJS);
    const peer = new window.Peer();
    try {
      await withTimeout(new Promise((resolve, reject) => { peer.on('open', resolve); peer.on('error', reject); }), 8000, 'peer');
      const conn = peer.connect(peerId(kind, code), { reliable: true });
      await withTimeout(new Promise((resolve, reject) => {
        conn.on('open', resolve);
        peer.on('error', reject);
      }), 8000, 'peer');
      // zamknięcie połączenia zamyka też całego „peera” (żeby nie wisiał w tle)
      conn.on('close', () => peer.destroy());
      return { peer, conn };
    } catch (e) {
      peer.destroy();
      throw e;
    }
  }

  // pokój: to urządzenie czeka na połączenia (onConn dostaje każde nowe – bezpośrednie albo przez MQTT);
  // close() zamyka pokój i rozłącza wszystkich
  async function host(kind, onConn, preferred) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = attempt === 0 && normCode(preferred).length === 4 ? normCode(preferred) : rand(4);
      const [w, p, m] = await Promise.allSettled([RELAY_URL ? wsHost(kind, code, onConn) : Promise.reject(new Error('off')),
        peerHost(kind, code, onConn), mqttHost(kind, code, onConn)]);
      const wsOk = w.status === 'fulfilled' && typeof w.value === 'function';
      const peerOk = p.status === 'fulfilled' && typeof p.value === 'function';
      const mqttOk = m.status === 'fulfilled';
      const close = () => { if (wsOk) w.value(); if (peerOk) p.value(); if (mqttOk) m.value(); };
      // kod zajęty – losujemy inny
      if ((p.status === 'fulfilled' && p.value === 'taken') || (w.status === 'fulfilled' && w.value === 'taken')) { close(); continue; }
      if (wsOk || peerOk || mqttOk) return { code, server: wsOk, direct: peerOk, relay: mqttOk, close };
      throw new Error('offline');
    }
    throw new Error('unavailable-id');
  }

  // dołączenie do pokoju: oba kanały naraz – wygrywa ten, który pierwszy się połączy, drugi od razu zamykamy
  // (wcześniej najpierw czekaliśmy na WebRTC – przy zablokowanym WebRTC trwało to kilkanaście sekund)
  function connect(kind, code) {
    code = normCode(code);
    // ?relay=1 – od razu przez serwer pośredniczący (diagnostyka i testy)
    if (/[?&]relay=1/.test(window.location.search)) return mqttConnect(kind, code);
    // najpierw własny serwer pośredniczący (szybki i działa w każdej sieci); gdy go nie ma albo nie odpowiada – jak dawniej
    if (RELAY_URL) return wsConnect(kind, code).catch(() => race(kind, code));
    return race(kind, code);
  }
  function race(kind, code) {
    const tries = [peerConnect(kind, code), mqttConnect(kind, code)];
    let winner = null;
    let failed = 0;
    return new Promise((resolve, reject) => {
      tries.forEach((t) => t.then((res) => {
        if (winner) { try { res.conn.close(); } catch (e) { /* już zamknięte */ } if (res.peer) res.peer.destroy(); return; }
        winner = res;
        resolve(res);
      }, (e) => { failed += 1; if (failed === tries.length) reject(e); }));
    });
  }

  // biblioteki pobieramy od razu przy starcie strony gracza – oszczędza to sekundę–dwie przy łączeniu
  const preload = () => Promise.allSettled([loadScript(PEERJS), loadScript(MQTTJS)]);

  // kod QR jako SVG; ecc – poziom korekcji błędów (L mieści najwięcej danych, np. talię kart w linku)
  async function qrSvg(text, ecc) {
    await loadScript(QRLIB);
    const qr = window.qrcode(0, ecc || 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  // adres strony w tym samym katalogu (działa i na GitHub Pages, i na własnej domenie)
  const pageUrl = (file, params) => {
    const u = new URL(file, window.location.href);
    u.search = params ? new URLSearchParams(params).toString() : '';
    u.hash = '';
    return u.toString();
  };

  window.KragNet = { host, connect, qrSvg, pageUrl, normCode, preload };
}());
