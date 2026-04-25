/**
 * Android SMS Gateway channel adapter (v2).
 *
 * Stands up a localhost HTTP webhook server that the Android SMS Gateway app
 * posts to when an SMS is received:
 *  - POST / — inbound SMS event: { event: 'sms:received', payload: { sender, message, ... } }
 *
 * Outbound: POSTs to the gateway's /message endpoint with Basic auth.
 * The webhook port binds to loopback only — TLS termination handled by tailscale serve.
 */
import http from 'node:http';
import https from 'node:https';

import { readEnvFile } from '../env.js';
import { log } from '../log.js';
import { registerChannelAdapter } from './channel-registry.js';
import type { ChannelAdapter, ChannelSetup, InboundMessage, OutboundMessage } from './adapter.js';

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const c = content as { text?: unknown };
    if (typeof c.text === 'string') return c.text;
  }
  return '';
}

function createSmsAndroidAdapter(opts: {
  gatewayUrl: string;
  user: string;
  pass: string;
  port: number;
}): ChannelAdapter {
  const gatewayUrl = opts.gatewayUrl.replace(/\/$/, '');
  let server: http.Server | null = null;
  let setupConfig: ChannelSetup | null = null;

  return {
    name: 'sms-android',
    channelType: 'sms',
    supportsThreads: false,

    async setup(config: ChannelSetup): Promise<void> {
      setupConfig = config;

      server = http.createServer((req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405).end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as {
              event?: string;
              payload?: { sender?: string; message?: string; messageId?: string; receivedAt?: string };
            };

            if (data.event !== 'sms:received' || !data.payload) {
              res.writeHead(200).end();
              return;
            }

            const { sender, message, messageId, receivedAt } = data.payload;
            if (!sender) {
              res.writeHead(400).end();
              return;
            }

            const platformId = sender;
            const timestamp = receivedAt ?? new Date().toISOString();

            config.onMetadata(platformId, platformId, false);

            const inbound: InboundMessage = {
              id: messageId ?? `sms-${Date.now()}`,
              kind: 'chat',
              content: {
                text: message ?? '',
                sender: platformId,
                senderId: `sms:${platformId}`,
              },
              timestamp,
              isGroup: false,
            };

            setupConfig?.onInbound(platformId, null, inbound);
            log.info('SMS received via Android gateway', { from: platformId });
            res.writeHead(200).end();
          } catch (err) {
            log.error('Android SMS: failed to handle inbound webhook', { err });
            res.writeHead(500).end();
          }
        });
      });

      await new Promise<void>((resolve, reject) => {
        server!.once('error', reject);
        server!.listen(opts.port, '127.0.0.1', () => {
          log.info('Android SMS webhook listening (via tailscale serve)', { port: opts.port });
          resolve();
        });
      });
    },

    async teardown(): Promise<void> {
      if (!server) return;
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
      log.info('Android SMS channel stopped');
    },

    isConnected(): boolean {
      return server?.listening ?? false;
    },

    async deliver(platformId: string, _threadId: string | null, message: OutboundMessage): Promise<string | undefined> {
      const text = extractText(message.content);
      if (!text) return undefined;

      const body = JSON.stringify({
        textMessage: { text },
        phoneNumbers: [platformId],
      });

      const url = new URL(`${gatewayUrl}/message`);
      const isHttps = url.protocol === 'https:';
      const credentials = Buffer.from(`${opts.user}:${opts.pass}`).toString('base64');
      const mod = isHttps ? https : http;

      await new Promise<void>((resolve, reject) => {
        const req = mod.request(
          {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: '/message',
            method: 'POST',
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              if (res.statusCode && res.statusCode < 300) {
                log.info('SMS sent via Android gateway', { to: platformId, length: text.length });
                resolve();
              } else {
                log.error('Android SMS gateway error', { to: platformId, status: res.statusCode, body: data });
                reject(new Error(`Android SMS gateway ${res.statusCode}`));
              }
            });
          },
        );
        req.on('error', (err) => {
          log.error('Android SMS send request failed', { to: platformId, err });
          reject(err as Error);
        });
        req.write(body);
        req.end();
      });

      return `sms-out-${Date.now()}`;
    },
  };
}

registerChannelAdapter('sms-android', {
  factory: () => {
    const env = readEnvFile(['SMS_GATEWAY_URL', 'SMS_GATEWAY_USER', 'SMS_GATEWAY_PASS', 'SMS_WEBHOOK_PORT']);
    const gatewayUrl = process.env.SMS_GATEWAY_URL || env.SMS_GATEWAY_URL || '';
    const user = process.env.SMS_GATEWAY_USER || env.SMS_GATEWAY_USER || '';
    const pass = process.env.SMS_GATEWAY_PASS || env.SMS_GATEWAY_PASS || '';
    const portStr = process.env.SMS_WEBHOOK_PORT || env.SMS_WEBHOOK_PORT || '8767';

    if (!gatewayUrl || !user || !pass) return null;

    return createSmsAndroidAdapter({ gatewayUrl, user, pass, port: parseInt(portStr, 10) });
  },
});
