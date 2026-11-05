import tls from 'node:tls';

function readReply(socket) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const cleanup = () => { socket.off('data', onData); socket.off('error', onError); socket.off('close', onClose); };
    const onError = (error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error('SMTP connection closed unexpectedly.')); };
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return;
      const last = lines[lines.length - 1];
      if (/^\d{3} /.test(last)) {
        cleanup();
        const code = Number(last.slice(0, 3));
        if (code >= 400) reject(new Error(`SMTP server rejected a command (${code}).`));
        else resolve({ code, text: lines.join('\n') });
      }
    };
    socket.on('data', onData); socket.once('error', onError); socket.once('close', onClose);
  });
}

async function command(socket, line) { const reply = readReply(socket); socket.write(`${line}\r\n`); return reply; }
const b64 = (value) => Buffer.from(value, 'utf8').toString('base64');
const cleanHeader = (value) => String(value).replace(/[\r\n]/g, ' ').trim();

/** SMTP over implicit TLS (port 465), matching the project's Gmail SMTP configuration. */
export async function sendEmail({ to, subject, text, html }) {
  const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASSWORD: password, MAIL_FROM: fromRaw } = process.env;
  const port = Number(process.env.SMTP_PORT || 465);
  if (!host || !user || !password || !fromRaw) throw new Error('SMTP is not fully configured. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD and MAIL_FROM.');
  if (port !== 465) throw new Error('SMTP_PORT must be 465 for the configured implicit-TLS transport.');
  const fromMatch = fromRaw.match(/<([^<>]+)>/);
  const fromAddress = (fromMatch?.[1] || fromRaw).trim();
  const fromName = fromMatch ? fromRaw.slice(0, fromMatch.index).trim().replace(/^"|"$/g, '') : fromAddress;
  const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
  socket.setTimeout(20_000, () => socket.destroy(new Error('SMTP connection timed out.')));
  try {
    const greetingPromise = readReply(socket);
    greetingPromise.catch(() => {}); // if the connection fails first, this promise must not become an unhandled rejection (it would crash the server process)
    await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
    const greeting = await greetingPromise;
    if (greeting.code !== 220) throw new Error('SMTP server did not accept the connection.');
    await command(socket, `EHLO ${cleanHeader(process.env.SMTP_HELO || 'localhost')}`);
    await command(socket, 'AUTH LOGIN');
    await command(socket, b64(user));
    await command(socket, b64(password));
    await command(socket, `MAIL FROM:<${cleanHeader(fromAddress)}>`);
    await command(socket, `RCPT TO:<${cleanHeader(to)}>`);
    await command(socket, 'DATA');
    const boundary = `sipchill_${Date.now().toString(36)}`;
    const encodedSubject = `=?UTF-8?B?${b64(cleanHeader(subject))}?=`;
    const body = [
      `From: ${cleanHeader(fromName)} <${cleanHeader(fromAddress)}>`, `To: <${cleanHeader(to)}>`, `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
      `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text),
      `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html), `--${boundary}--`,
    ].join('\r\n').replace(/(^|\r\n)\./g, '$1..');
    const dataReply = readReply(socket);
    socket.write(`${body}\r\n.\r\n`);
    await dataReply;
    await command(socket, 'QUIT');
  } finally { socket.end(); }
}
