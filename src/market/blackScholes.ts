// Black-Scholes pricing used to derive simulated option premiums from the index spot.

function normCdf(x: number): number {
  // Abramowitz & Stegun 26.2.17
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

export interface OptionPrice {
  price: number;
  delta: number;
}

export function blackScholes(
  type: 'CE' | 'PE',
  spot: number,
  strike: number,
  years: number,
  iv: number,
  rate = 0.065,
): OptionPrice {
  const t = Math.max(years, 1 / (365 * 24));
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + (rate + (iv * iv) / 2) * t) / (iv * sqrtT);
  const d2 = d1 - iv * sqrtT;
  if (type === 'CE') {
    return {
      price: spot * normCdf(d1) - strike * Math.exp(-rate * t) * normCdf(d2),
      delta: normCdf(d1),
    };
  }
  return {
    price: strike * Math.exp(-rate * t) * normCdf(-d2) - spot * normCdf(-d1),
    delta: normCdf(d1) - 1,
  };
}
