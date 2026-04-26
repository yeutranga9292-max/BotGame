import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MezonClient } from 'mezon-sdk';

/**
 * Wraps the singleton MezonClient and exposes a Promise that resolves once
 * the client emits "ready". Other services should `await getClient()` before
 * using the client, otherwise calls may be made before login completes.
 */
@Injectable()
export class MezonClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MezonClientService.name);
  private client?: MezonClient;
  private readyPromise?: Promise<MezonClient>;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const botId = this.config.get<string>('MEZON_BOT_ID');
    const token = this.config.get<string>('MEZON_BOT_TOKEN');

    if (!botId || !token) {
      this.logger.warn(
        'MEZON_BOT_ID or MEZON_BOT_TOKEN is missing. Mezon client will not start. ' +
          'Set them in your environment to enable the bot.',
      );
      return;
    }

    this.client = new MezonClient({
      botId,
      token,
      host: this.config.get<string>('MEZON_HOST') ?? 'gw.mezon.ai',
      port: this.config.get<string>('MEZON_PORT') ?? '443',
      useSSL: (this.config.get<string>('MEZON_USE_SSL') ?? 'true').toLowerCase() === 'true',
    });

    this.readyPromise = new Promise<MezonClient>((resolve) => {
      this.client!.on('ready', () => {
        this.logger.log(`Mezon client ready (clientId=${this.client!.clientId})`);
        resolve(this.client!);
      });
    });

    try {
      await this.client.login();
      this.logger.log('Mezon login() resolved');
    } catch (err) {
      this.logger.error('Mezon login failed', err as Error);
    }
  }

  async onModuleDestroy() {
    try {
      this.client?.closeSocket?.();
    } catch (err) {
      this.logger.warn(`Error closing socket: ${(err as Error).message}`);
    }
  }

  /** Returns the live client once it has emitted ready. */
  async getClient(): Promise<MezonClient> {
    if (!this.client || !this.readyPromise) {
      throw new Error('Mezon client is not configured. Set MEZON_BOT_ID and MEZON_BOT_TOKEN.');
    }
    return this.readyPromise;
  }

  /** Returns the underlying client synchronously, or undefined if not started. */
  getClientUnsafe(): MezonClient | undefined {
    return this.client;
  }
}
