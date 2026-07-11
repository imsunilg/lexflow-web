import { parseTimeSpanToSeconds } from './timer.service';

describe('parseTimeSpanToSeconds', () => {
  it('parses hh:mm:ss', () => {
    expect(parseTimeSpanToSeconds('00:12:34')).toBe(12 * 60 + 34);
  });

  it('parses a fractional-seconds suffix', () => {
    expect(parseTimeSpanToSeconds('00:00:05.1234567')).toBe(5);
  });

  it('parses a leading day component', () => {
    expect(parseTimeSpanToSeconds('1.02:00:00')).toBe(24 * 3600 + 2 * 3600);
  });

  it('returns 0 for an unparseable string', () => {
    expect(parseTimeSpanToSeconds('not-a-timespan')).toBe(0);
  });

  it('returns 0 for an empty string', () => {
    expect(parseTimeSpanToSeconds('')).toBe(0);
  });
});
