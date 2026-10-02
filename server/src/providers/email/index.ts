import { EmailProvider } from '../../types';
import { SmtpEmailProvider } from './smtp';
import { config } from '../../config';

export function createEmailProvider(): EmailProvider {
  switch (config.email.provider) {
    case 'smtp':
      return new SmtpEmailProvider(config.email.smtp, config.email.from);
    default:
      throw new Error(`Unknown email provider: ${config.email.provider}`);
  }
}
