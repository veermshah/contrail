import { bestTime, delayMinutes, fmtDuration } from './format';
import { flightWindow, isPast, statusLabel } from './flights';
import { C } from './theme';
import type { Flight } from './types';

export function summarize(f: Flight, now = Date.now()) {
  const dDep = delayMinutes(f.departure);
  const dArr = delayMinutes(f.arrival);
  const { dep, arr } = flightWindow(f);
  const canceled = f.status === 'Canceled' || f.status === 'CanceledUncertain';
  const delayed = Math.max(dDep, dArr) >= 15;
  const color = canceled ? C.red : f.status === 'Diverted' ? C.red : delayed ? C.amber : C.green;
  const tag = canceled
    ? 'Canceled'
    : f.status === 'Diverted'
      ? 'Diverted'
      : f.source === 'route'
        ? 'Route only'
        : delayed
          ? `${fmtDuration(Math.max(dDep, dArr))} late`
          : dDep < -5
            ? 'Early'
            : 'On time';

  let headline: string;
  if (canceled) headline = 'This flight was canceled';
  else if (!dep) headline = statusLabel(f.status);
  else if (f.status === 'Arrived' || (arr && now > arr && isPast(f, now)))
    headline = arr ? `Landed ${fmtDuration((now - arr) / 60000)} ago` : 'Landed';
  else if (now < dep) headline = `Departs in ${fmtDuration((dep - now) / 60000)}`;
  else if (arr && now < arr) headline = `Lands in ${fmtDuration((arr - now) / 60000)}`;
  else headline = statusLabel(f.status);

  return { headline, tag, color, depTime: bestTime(f.departure), arrTime: bestTime(f.arrival), dDep, dArr };
}
