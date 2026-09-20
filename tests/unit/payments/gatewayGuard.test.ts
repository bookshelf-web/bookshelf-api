describe('getPaymentGateway', () => {
  const load = (simulatedPaymentsEnabled: boolean) => {
    jest.resetModules();
    jest.doMock('../../../src/config/env', () => ({ env: { simulatedPaymentsEnabled } }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../../src/contexts/payments') as typeof import('../../../src/contexts/payments');
  };

  afterEach(() => jest.dontMock('../../../src/config/env'));

  it('returns the simulator when simulated payments are enabled', () => {
    expect(load(true).getPaymentGateway().name).toBe('simulated');
  });

  it('refuses with PAYMENTS_DISABLED otherwise', () => {
    const payments = load(false);
    expect(() => payments.getPaymentGateway()).toThrow(payments.PaymentsDisabledError);
    expect(new payments.PaymentsDisabledError()).toMatchObject({ statusCode: 503, code: 'PAYMENTS_DISABLED' });
  });
});
