import { PaymentProvider } from '../../types';
import { BonCardProvider } from './boncard';
import { config } from '../../config';

export function createPaymentProvider(): PaymentProvider {
  return new BonCardProvider(
    config.boncard.apiUrl,
    config.boncard.apiKey,
    config.boncard.secretKey,
    config.boncard.callbackUrl
  );
}
