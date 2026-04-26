import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChannelMessage } from 'mezon-sdk';
import { MezonClientService } from '../mezon/mezon-client.service';
import { CommandHandler } from './command.handler';

/**
 * Subscribes to Mezon channel messages and dispatches them to the
 * CommandHandler when the message starts with the configured prefix.
 */
@Injectable()
export class BotService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BotService.name);
  private readonly prefix: string;

  constructor(
    private readonly mezon: MezonClientService,
    private readonly handler: CommandHandler,
    private readonly config: ConfigService,
  ) {
    this.prefix = this.config.get<string>('BOT_PREFIX') ?? '!';
  }

  async onApplicationBootstrap() {
    if (!this.mezon.getClientUnsafe()) {
      this.logger.warn('Mezon client not started; skipping event registration.');
      return;
    }
    const client = await this.mezon.getClient();
    this.logger.log(`Registering channel-message listener (prefix="${this.prefix}")`);

    client.onChannelMessage(async (message: ChannelMessage) => {
      try {
        await this.handleMessage(message);
      } catch (err) {
        this.logger.error('Error handling message', err as Error);
      }
    });
  }

  private async handleMessage(message: ChannelMessage) {
    if (message.sender_id === this.mezon.getClientUnsafe()?.clientId) return;
    const text = message.content?.t?.trim();
    if (!text) return;
    if (!text.startsWith(this.prefix)) return;

    const stripped = text.slice(this.prefix.length).trim();
    if (!stripped) return;

    const [rawCmd, ...args] = stripped.split(/\s+/);
    const command = rawCmd.toLowerCase();
    await this.handler.dispatch(command, args, message);
  }
}
