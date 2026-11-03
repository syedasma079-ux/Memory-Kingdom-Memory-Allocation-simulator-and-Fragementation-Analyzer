import type { AssumptionRow } from '../types/engine';

export const ASSUMPTIONS: AssumptionRow[] = [
  {
    id: 'ASM-1',
    rule: 'Demotion trigger: always vs only-if-contended',
    defaultValue: 'always',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-2',
    rule: 'Admission ordering: fifo-block vs skip-ahead',
    defaultValue: 'fifo-block',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-3',
    rule: 'Tick-boundary order: release, arrivals, admission, dispatch',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-4',
    rule: 'Retry rule after memory release / head change',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-5',
    rule: 'Feedback queue demotion and Q3 round-robin',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-6',
    rule: 'Idle handling still advances the clock',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-7',
    rule: 'READY vs SUSPENDED state mapping',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-8',
    rule: 'Next Fit pointer after exact fit / failure',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-9',
    rule: 'Search steps include allocated blocks examined',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-10',
    rule: 'Best/Worst Fit ties → lowest offset',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-11',
    rule: 'Finishing process releases at end of final slice',
    defaultValue: 'as listed',
    status: 'UNVERIFIED'
  },
  {
    id: 'ASM-12',
    rule: 'Resource columns carried but ignored for scheduling',
    defaultValue: 'ignored',
    status: 'UNVERIFIED'
  }
];
