// ─── Types ─────────────────────────────────────────────────────────────────

export interface MockCandidate {
  id: string;
  name: string;
  tags: string[];
}

export interface MockMessage {
  id: string;
  candidateId: string;
  type: 'email' | 'sms';
  direction: 'outbound' | 'inbound';
  campaign: string | null;
  sentBy: string | null;
  date: Date;
  status: 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced';
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'short_text' | 'long_text' | 'date' | 'number';

export interface MockQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
}

export interface MockSurvey {
  id: string;
  name: string;
  questions: MockQuestion[];
}

export interface MockSurveyResponse {
  id: string;
  surveyId: string;
  candidateId: string;
  sentAt: Date;
  completedAt: Date;
  answers: Record<string, string | string[] | number>;
}

// ─── Seeded PRNG ────────────────────────────────────────────────────────────

function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Fisher-Yates shuffle in-place using provided rng
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Names ──────────────────────────────────────────────────────────────────

const NAMES = [
  'Marcus Williams', 'Jennifer Martinez', 'Darius Thompson', 'Ashley Chen',
  'Robert Johnson', 'Mia Rodriguez', 'Kevin Park', 'Tanya Brooks',
  'James Henderson', 'Samantha Wright', 'Elijah Davis', 'Brittany Moore',
  'Andre Wilson', 'Christina Taylor', 'Devon Jackson', 'Rachel Anderson',
  'Tyler Scott', 'Monique Harris', 'Cameron Lewis', 'Lauren Robinson',
  'Isaiah Clark', 'Stephanie Walker', 'Brandon Hall', 'Nicole Young',
  'Malik Allen', 'Hannah King', 'Jordan Hill', 'Emily Carter',
  'Terrence Mitchell', 'Amber Phillips', 'Damon Nelson', 'Sarah Turner',
  'Quincy Barnes', 'Megan Roberts', 'Victor Cooper', 'Kelsey Bailey',
  'Marcus Flores', 'Jasmine Washington', 'Anthony Rivera', 'Diana Coleman',
  'Kendall Reed', 'Tiffany Morgan', 'Reggie Price', 'Courtney Powell',
  'Luther Long', 'Veronica Howard', 'Preston Patterson', 'Destiny Simmons',
  'Darnell Ward', 'Monica Ramirez', 'Cedric Jenkins', 'Natasha Perry',
  'Lamar Russell', 'Heather Griffin', 'Damien Foster', 'Brianna Hughes',
  'Tyrone Hayes', 'Krystal Richardson', 'Calvin Sanders', 'Alicia Price',
  'Jamal Price', 'Meghan Cook', 'Desmond Bailey', 'Yolanda Wood',
  'Randall Nelson', 'Felicia Cruz', 'Frederick Torres', 'Cassandra Ward',
  'Vincent Reyes', 'Lydia Bell', 'Cornelius Adams', 'Sabrina Evans',
  'Reginald Thomas', 'Gwendolyn Fox', 'Solomon Murphy', 'Jocelyn Ross',
  'Broderick Nguyen', 'Tamara Henderson', 'Alonzo Diaz', 'Chanel Martin',
];

// ─── Tag distributions ───────────────────────────────────────────────────────

const rng42 = makePrng(42);

const positionArr = shuffle(
  [
    ...Array(32).fill('Police Officer'),
    ...Array(20).fill('Firefighter'),
    ...Array(16).fill("Sheriff's Deputy"),
    ...Array(8).fill('Dispatcher'),
    ...Array(4).fill('Records Clerk'),
  ],
  rng42
);

const sourceArr = shuffle(
  [
    ...Array(28).fill('Online Application'),
    ...Array(20).fill('Job Fair'),
    ...Array(16).fill('Employee Referral'),
    ...Array(12).fill('LinkedIn'),
    ...Array(4).fill('Walk-in'),
  ],
  rng42
);

const stageArr = shuffle(
  [
    ...Array(12).fill('Applied'),
    ...Array(15).fill('Phone Screen Complete'),
    ...Array(15).fill('Written Exam Complete'),
    ...Array(12).fill('Physical Agility Passed'),
    ...Array(10).fill('Oral Board Complete'),
    ...Array(8).fill('Background Check'),
    ...Array(4).fill('Conditional Offer'),
    ...Array(12).fill('Hired'),
    ...Array(8).fill('Withdrawn'),
  ],
  rng42
);

// ─── Candidates ──────────────────────────────────────────────────────────────

export const MOCK_CANDIDATES: MockCandidate[] = NAMES.map((name, i) => ({
  id: `cand-${i + 1}`,
  name,
  tags: [
    `Position > ${positionArr[i]}`,
    `Source > ${sourceArr[i]}`,
    `Stage > ${stageArr[i]}`,
  ],
}));

// ─── Helper: filter candidates ───────────────────────────────────────────────

export function getMockTagGroups(): { name: string; tags: string[] }[] {
  return [
    {
      name: 'Position',
      tags: ['Police Officer', 'Firefighter', "Sheriff's Deputy", 'Dispatcher', 'Records Clerk'],
    },
    {
      name: 'Source',
      tags: ['Online Application', 'Job Fair', 'Employee Referral', 'LinkedIn', 'Walk-in'],
    },
    {
      name: 'Stage',
      tags: [
        'Applied', 'Phone Screen Complete', 'Written Exam Complete', 'Physical Agility Passed',
        'Oral Board Complete', 'Background Check', 'Conditional Offer', 'Hired', 'Withdrawn',
      ],
    },
  ];
}

export function filterCandidatesByTag(
  candidates: MockCandidate[],
  tagGroup: string | null,
  tag: string | null
): MockCandidate[] {
  if (!tagGroup && !tag) return candidates;
  return candidates.filter((c) => {
    if (tagGroup && tag) return c.tags.includes(`${tagGroup} > ${tag}`);
    if (tagGroup) return c.tags.some((t) => t.startsWith(`${tagGroup} > `));
    if (tag) return c.tags.some((t) => t.endsWith(` > ${tag}`));
    return true;
  });
}

// tagFilters: { group -> selected tag values }; OR within group, AND across groups
export function filterCandidatesByMultiTag(
  candidates: MockCandidate[],
  tagFilters: Record<string, string[]>
): MockCandidate[] {
  const active = Object.entries(tagFilters).filter(([, tags]) => tags.length > 0);
  if (active.length === 0) return candidates;
  return candidates.filter((c) =>
    active.every(([group, tags]) =>
      tags.some((tag) => c.tags.includes(`${group} > ${tag}`))
    )
  );
}

// ─── Messages ────────────────────────────────────────────────────────────────

function randomDate(rng: () => number, start: Date, end: Date): Date {
  const ms = start.getTime() + Math.floor(rng() * (end.getTime() - start.getTime()));
  return new Date(ms);
}

function applyMessageStatus(
  rng: () => number,
  type: 'email' | 'sms',
  openRate: number,
  replyRate: number,
  bounceRate: number
): 'bounced' | 'delivered' | 'opened' | 'replied' {
  if (rng() < bounceRate) return 'bounced';
  if (rng() > 0.93) return 'delivered'; // 7% undelivered just stay delivered
  if (type === 'sms') return 'delivered';
  if (rng() < openRate) {
    if (rng() < replyRate) return 'replied';
    return 'opened';
  }
  return 'delivered';
}

const rng137 = makePrng(137);

let msgCounter = 0;
function nextMsgId() { return `msg-${++msgCounter}`; }

const SENDERS = ['Sarah Mitchell', 'James Torres', 'Ashley Kim', 'Brian Nguyen'];

interface CampaignDef {
  name: string;
  start: Date;
  end: Date;
  targetCandidates: MockCandidate[];
  emailPct: number; // 0-1
  openRate: number;
  replyRate: number;
  bounceRate: number;
}

const candidatesBySource = (src: string) =>
  MOCK_CANDIDATES.filter((c) => c.tags.includes(`Source > ${src}`));

const candidatesByStageIn = (stages: string[]) =>
  MOCK_CANDIDATES.filter((c) => stages.some((s) => c.tags.includes(`Stage > ${s}`)));

const candidatesByStageNotIn = (stages: string[]) =>
  MOCK_CANDIDATES.filter((c) => !stages.some((s) => c.tags.includes(`Stage > ${s}`)));

const candidatesJobFair = candidatesBySource('Job Fair'); // 20
const candidatesNotAppliedWithdrawn = candidatesByStageNotIn(['Applied', 'Withdrawn']);
const candidatesBgHired = candidatesByStageIn(['Background Check', 'Conditional Offer', 'Hired']);
const candidatesHired = candidatesByStageIn(['Hired']);
const candidatesNotWithdrawn = candidatesByStageNotIn(['Withdrawn']);

const CAMPAIGNS: CampaignDef[] = [
  {
    name: 'Initial Outreach',
    start: new Date('2025-01-10'),
    end: new Date('2025-01-31'),
    targetCandidates: MOCK_CANDIDATES,
    emailPct: 0.7,
    openRate: 0.45,
    replyRate: 0.18,
    bounceRate: 0.05,
  },
  {
    name: 'Job Fair Follow-up',
    start: new Date('2025-03-10'),
    end: new Date('2025-03-25'),
    targetCandidates: candidatesJobFair,
    emailPct: 1.0,
    openRate: 0.45,
    replyRate: 0.18,
    bounceRate: 0.05,
  },
  {
    name: 'Written Exam Invitation',
    start: new Date('2025-04-05'),
    end: new Date('2025-04-20'),
    targetCandidates: candidatesNotAppliedWithdrawn,
    emailPct: 0.6,
    openRate: 0.45,
    replyRate: 0.18,
    bounceRate: 0.05,
  },
  {
    name: 'Background Check Request',
    start: new Date('2025-06-15'),
    end: new Date('2025-06-30'),
    targetCandidates: candidatesBgHired,
    emailPct: 1.0,
    openRate: 0.65,
    replyRate: 0.18,
    bounceRate: 0.05,
  },
  {
    name: 'Welcome to the Team',
    start: new Date('2025-09-05'),
    end: new Date('2025-09-15'),
    targetCandidates: candidatesHired,
    emailPct: 1.0,
    openRate: 0.85,
    replyRate: 0.18,
    bounceRate: 0.05,
  },
  {
    name: 'Q4 2025 Newsletter',
    start: new Date('2025-10-01'),
    end: new Date('2025-10-05'),
    targetCandidates: candidatesNotWithdrawn,
    emailPct: 1.0,
    openRate: 0.38,
    replyRate: 0.18,
    bounceRate: 0.05,
  },
  {
    name: 'Q1 2026 Newsletter',
    start: new Date('2026-01-06'),
    end: new Date('2026-01-10'),
    targetCandidates: candidatesNotWithdrawn,
    emailPct: 1.0,
    openRate: 0.40,
    replyRate: 0.18,
    bounceRate: 0.05,
  },
  {
    name: 'Q2 2026 Newsletter',
    start: new Date('2026-04-07'),
    end: new Date('2026-04-11'),
    targetCandidates: candidatesNotWithdrawn,
    emailPct: 1.0,
    openRate: 0.42,
    replyRate: 0.18,
    bounceRate: 0.05,
  },
];

const MOCK_MESSAGES_RAW: MockMessage[] = [];

// Campaign messages
for (const camp of CAMPAIGNS) {
  for (const cand of camp.targetCandidates) {
    const isEmail = rng137() < camp.emailPct;
    const type: 'email' | 'sms' = isEmail ? 'email' : 'sms';
    const date = randomDate(rng137, camp.start, camp.end);
    const status = applyMessageStatus(rng137, type, camp.openRate, camp.replyRate, camp.bounceRate);
    const sender = SENDERS[Math.floor(rng137() * SENDERS.length)];

    const outMsg: MockMessage = {
      id: nextMsgId(),
      candidateId: cand.id,
      type,
      direction: 'outbound',
      campaign: camp.name,
      sentBy: sender,
      date,
      status,
    };
    MOCK_MESSAGES_RAW.push(outMsg);

    // ~40% chance of an inbound reply within 1-3 days
    if (status === 'replied' || (status === 'opened' && rng137() < 0.3)) {
      const replyDelay = (1 + Math.floor(rng137() * 3)) * 24 * 60 * 60 * 1000;
      const replyDate = new Date(date.getTime() + replyDelay);
      MOCK_MESSAGES_RAW.push({
        id: nextMsgId(),
        candidateId: cand.id,
        type,
        direction: 'inbound',
        campaign: camp.name,
        sentBy: null,
        date: replyDate,
        status: 'delivered',
      });
    }
  }
}

// ~120 individual outbound messages (Jan 2025 – Jul 2026)
const indivStart = new Date('2025-01-01');
const indivEnd = new Date('2026-07-31');
for (let i = 0; i < 120; i++) {
  const cand = MOCK_CANDIDATES[Math.floor(rng137() * MOCK_CANDIDATES.length)];
  const type: 'email' | 'sms' = rng137() < 0.4 ? 'email' : 'sms';
  const date = randomDate(rng137, indivStart, indivEnd);
  const sender = SENDERS[Math.floor(rng137() * SENDERS.length)];
  const status = applyMessageStatus(rng137, type, 0.4, 0.15, 0.04);
  MOCK_MESSAGES_RAW.push({
    id: nextMsgId(),
    candidateId: cand.id,
    type,
    direction: 'outbound',
    campaign: null,
    sentBy: sender,
    date,
    status,
  });
}

// ~80 inbound individual replies
for (let i = 0; i < 80; i++) {
  const cand = MOCK_CANDIDATES[Math.floor(rng137() * MOCK_CANDIDATES.length)];
  const type: 'email' | 'sms' = rng137() < 0.4 ? 'email' : 'sms';
  const date = randomDate(rng137, indivStart, indivEnd);
  MOCK_MESSAGES_RAW.push({
    id: nextMsgId(),
    candidateId: cand.id,
    type,
    direction: 'inbound',
    campaign: null,
    sentBy: null,
    date,
    status: 'delivered',
  });
}

export const MOCK_MESSAGES: MockMessage[] = MOCK_MESSAGES_RAW;

// ─── Surveys ──────────────────────────────────────────────────────────────────

export const MOCK_SURVEYS: MockSurvey[] = [
  {
    id: 'survey-1',
    name: 'Candidate Interest Form',
    questions: [
      {
        id: 's1q1',
        text: 'Which position are you applying for?',
        type: 'single_choice',
        options: ['Police Officer', 'Firefighter', "Sheriff's Deputy", 'Dispatcher', 'Records Clerk'],
      },
      {
        id: 's1q2',
        text: 'How did you hear about this opportunity?',
        type: 'single_choice',
        options: ['Online Application', 'Job Fair', 'Employee Referral', 'LinkedIn', 'Walk-in'],
      },
      {
        id: 's1q3',
        text: 'Are you currently employed?',
        type: 'single_choice',
        options: ['Yes – Full Time', 'Yes – Part Time', 'No'],
      },
      {
        id: 's1q4',
        text: 'Years of relevant experience',
        type: 'number',
      },
      {
        id: 's1q5',
        text: 'Which shifts are you available for?',
        type: 'multiple_choice',
        options: ['Days (6am-2pm)', 'Evenings (2pm-10pm)', 'Nights (10pm-6am)', 'Weekends', 'Rotating'],
      },
      {
        id: 's1q6',
        text: 'What motivates you to pursue this role?',
        type: 'short_text',
      },
    ],
  },
  {
    id: 'survey-2',
    name: 'Physical Fitness Self-Assessment',
    questions: [
      {
        id: 's2q1',
        text: 'How many days per week do you currently exercise?',
        type: 'number',
      },
      {
        id: 's2q2',
        text: 'Can you complete 1.5 miles in under 15 minutes?',
        type: 'single_choice',
        options: ['Yes', 'No', 'Unsure'],
      },
      {
        id: 's2q3',
        text: 'Maximum push-ups in 2 minutes',
        type: 'number',
      },
      {
        id: 's2q4',
        text: 'Maximum sit-ups in 2 minutes',
        type: 'number',
      },
      {
        id: 's2q5',
        text: 'Do you have any physical limitations?',
        type: 'single_choice',
        options: ['No limitations', 'Minor – won\'t affect duty', 'Yes – requires accommodation'],
      },
    ],
  },
  {
    id: 'survey-3',
    name: 'Background Questionnaire',
    questions: [
      {
        id: 's3q1',
        text: 'Have you lived in-state for at least 5 years?',
        type: 'single_choice',
        options: ['Yes', 'No'],
      },
      {
        id: 's3q2',
        text: 'Have you ever been convicted of a felony?',
        type: 'single_choice',
        options: ['No', 'Yes – expunged', 'Yes – not expunged'],
      },
      {
        id: 's3q3',
        text: 'Most recent employer',
        type: 'short_text',
      },
      {
        id: 's3q4',
        text: 'Employment start date at most recent job',
        type: 'date',
      },
      {
        id: 's3q5',
        text: 'Primary reason for leaving / seeking new role',
        type: 'short_text',
      },
    ],
  },
  {
    id: 'survey-4',
    name: '90-Day Check-In',
    questions: [
      {
        id: 's4q1',
        text: 'Overall satisfaction with your role (1–10)',
        type: 'number',
      },
      {
        id: 's4q2',
        text: 'How well did onboarding prepare you for your duties?',
        type: 'single_choice',
        options: ['Very well', 'Adequately', 'Somewhat', 'Not well'],
      },
      {
        id: 's4q3',
        text: 'Have you received adequate ongoing training?',
        type: 'single_choice',
        options: ['Yes', 'Mostly', 'No'],
      },
      {
        id: 's4q4',
        text: 'What has been your biggest challenge so far?',
        type: 'long_text',
      },
      {
        id: 's4q5',
        text: 'Would you recommend this department to others?',
        type: 'single_choice',
        options: ['Definitely', 'Probably', 'Probably not', 'Definitely not'],
      },
      {
        id: 's4q6',
        text: 'Likelihood to remain with the department for 3+ years (1–10)',
        type: 'number',
      },
    ],
  },
];

// ─── Survey responses ─────────────────────────────────────────────────────────

const rng2025 = makePrng(2025);

function pickWeighted<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const S1_MOTIVATION_TEMPLATES = [
  'I have always wanted to serve my community and protect those who cannot protect themselves.',
  'This role aligns perfectly with my values of integrity, service, and public safety.',
  'Growing up, I looked up to officers in my neighborhood and always aspired to do the same.',
  'I am motivated by the opportunity to make a meaningful difference every single day.',
  'I want to build a career that has real impact and challenges me to grow professionally.',
  'My family has a tradition of public service and I am proud to continue that legacy.',
];

const S3_EMPLOYER_TEMPLATES = [
  'City of Springfield Public Works',
  'Riverside County Sheriff\'s Office',
  'Northgate Security Services',
  'Metro Transit Authority',
  'Lakeview Fire Department',
  'Allied Universal Security',
  'State Department of Corrections',
  'Bay Area Police Academy',
];

const S3_REASON_TEMPLATES = [
  'Seeking career advancement and greater responsibility.',
  'Looking for a role with better alignment to my long-term goals in public safety.',
  'Relocated to the area and looking for local opportunities.',
  'The organization was undergoing restructuring and I decided to pursue new opportunities.',
  'Seeking a position with stronger mission and community impact.',
];

const S4_CHALLENGE_TEMPLATES = [
  'Adapting to shift work and maintaining a healthy work-life balance has been the most significant adjustment. The irregular hours affect sleep patterns and personal routines, but I am learning to manage them effectively.',
  'The volume of paperwork and administrative requirements was initially overwhelming. I have been working to develop better systems and workflows to stay on top of documentation without sacrificing field time.',
  'Building relationships with the community and earning trust takes more time than I anticipated. Every interaction is an opportunity, and I am committed to being present and approachable.',
  'Navigating the internal processes and chain of command while also responding quickly in the field requires a balance I am still developing. My training has been invaluable in this regard.',
];

let respCounter = 0;
function nextRespId() { return `resp-${++respCounter}`; }

function generateSurveyAnswers(
  survey: MockSurvey,
  candidate: MockCandidate,
  rng: () => number
): Record<string, string | string[] | number> {
  const answers: Record<string, string | string[] | number> = {};

  for (const q of survey.questions) {
    switch (q.type) {
      case 'single_choice': {
        if (!q.options) break;
        // Apply realistic weights per question
        if (q.id === 's1q1') {
          // Match candidate's actual position
          const pos = candidate.tags.find((t) => t.startsWith('Position > '))?.replace('Position > ', '');
          answers[q.id] = pos ?? q.options[0];
        } else if (q.id === 's1q2') {
          // Match candidate's actual source
          const src = candidate.tags.find((t) => t.startsWith('Source > '))?.replace('Source > ', '');
          answers[q.id] = src ?? q.options[0];
        } else if (q.id === 's1q3') {
          answers[q.id] = pickWeighted(q.options, [0.55, 0.25, 0.20], rng);
        } else if (q.id === 's2q2') {
          answers[q.id] = pickWeighted(q.options, [0.65, 0.15, 0.20], rng);
        } else if (q.id === 's2q5') {
          answers[q.id] = pickWeighted(q.options, [0.72, 0.22, 0.06], rng);
        } else if (q.id === 's3q1') {
          answers[q.id] = pickWeighted(q.options, [0.85, 0.15], rng);
        } else if (q.id === 's3q2') {
          answers[q.id] = pickWeighted(q.options, [0.90, 0.07, 0.03], rng);
        } else if (q.id === 's4q2') {
          answers[q.id] = pickWeighted(q.options, [0.35, 0.40, 0.18, 0.07], rng);
        } else if (q.id === 's4q3') {
          answers[q.id] = pickWeighted(q.options, [0.50, 0.35, 0.15], rng);
        } else if (q.id === 's4q5') {
          answers[q.id] = pickWeighted(q.options, [0.55, 0.30, 0.10, 0.05], rng);
        } else {
          // uniform
          answers[q.id] = q.options[Math.floor(rng() * q.options.length)];
        }
        break;
      }
      case 'multiple_choice': {
        if (!q.options) break;
        // Pick 1-3 options; weight Days highest
        const count = 1 + Math.floor(rng() * 3);
        const pool = [...q.options];
        const chosen: string[] = [];
        // Always include Days with high probability
        if (rng() < 0.70 && pool.includes('Days (6am-2pm)')) {
          chosen.push('Days (6am-2pm)');
          pool.splice(pool.indexOf('Days (6am-2pm)'), 1);
        }
        while (chosen.length < count && pool.length > 0) {
          const idx = Math.floor(rng() * pool.length);
          chosen.push(pool[idx]);
          pool.splice(idx, 1);
        }
        answers[q.id] = chosen;
        break;
      }
      case 'number': {
        if (q.id === 's1q4') {
          // years experience 1-15
          answers[q.id] = 1 + Math.floor(rng() * 15);
        } else if (q.id === 's2q1') {
          // exercise days 2-6
          answers[q.id] = 2 + Math.floor(rng() * 5);
        } else if (q.id === 's2q3') {
          // push-ups 20-65
          answers[q.id] = 20 + Math.floor(rng() * 46);
        } else if (q.id === 's2q4') {
          // sit-ups 25-70
          answers[q.id] = 25 + Math.floor(rng() * 46);
        } else if (q.id === 's4q1') {
          // satisfaction 6-10
          answers[q.id] = 6 + Math.floor(rng() * 5);
        } else if (q.id === 's4q6') {
          // likelihood 6-10
          answers[q.id] = 6 + Math.floor(rng() * 5);
        } else {
          answers[q.id] = 1 + Math.floor(rng() * 10);
        }
        break;
      }
      case 'short_text': {
        if (q.id === 's1q6') {
          answers[q.id] = S1_MOTIVATION_TEMPLATES[Math.floor(rng() * S1_MOTIVATION_TEMPLATES.length)];
        } else if (q.id === 's3q3') {
          answers[q.id] = S3_EMPLOYER_TEMPLATES[Math.floor(rng() * S3_EMPLOYER_TEMPLATES.length)];
        } else if (q.id === 's3q5') {
          answers[q.id] = S3_REASON_TEMPLATES[Math.floor(rng() * S3_REASON_TEMPLATES.length)];
        } else {
          answers[q.id] = 'N/A';
        }
        break;
      }
      case 'long_text': {
        answers[q.id] = S4_CHALLENGE_TEMPLATES[Math.floor(rng() * S4_CHALLENGE_TEMPLATES.length)];
        break;
      }
      case 'date': {
        // Employment start date 2020-2025
        const yr = 2020 + Math.floor(rng() * 5);
        const mo = 1 + Math.floor(rng() * 12);
        const dy = 1 + Math.floor(rng() * 28);
        answers[q.id] = `${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
        break;
      }
    }
  }
  return answers;
}

function buildResponses(
  survey: MockSurvey,
  pool: MockCandidate[],
  completionRate: number,
  startDate: Date,
  endDate: Date,
  rng: () => number
): MockSurveyResponse[] {
  const responses: MockSurveyResponse[] = [];
  for (const cand of pool) {
    if (rng() > completionRate) continue;
    const completedAt = randomDate(rng, startDate, endDate);
    const answers = generateSurveyAnswers(survey, cand, rng);
    const daysBack = 3 + Math.floor(rng() * 18); // 3–20 days before completion
    const sentAt = new Date(Math.max(completedAt.getTime() - daysBack * 86_400_000, startDate.getTime()));
    responses.push({
      id: nextRespId(),
      surveyId: survey.id,
      candidateId: cand.id,
      sentAt,
      completedAt,
      answers,
    });
  }
  return responses;
}

const survey1Responses = buildResponses(
  MOCK_SURVEYS[0],
  MOCK_CANDIDATES,
  0.87,
  new Date('2025-01-01'),
  new Date('2025-03-31'),
  rng2025
);

const survey2Pool = candidatesByStageNotIn(['Applied', 'Withdrawn']);
const survey2Responses = buildResponses(
  MOCK_SURVEYS[1],
  survey2Pool,
  0.83,
  new Date('2025-04-01'),
  new Date('2025-06-30'),
  rng2025
);

const survey3Pool = candidatesByStageIn(['Background Check', 'Conditional Offer', 'Hired']);
const survey3Responses = buildResponses(
  MOCK_SURVEYS[2],
  survey3Pool,
  0.79,
  new Date('2025-06-01'),
  new Date('2025-09-30'),
  rng2025
);

const survey4Pool = candidatesByStageIn(['Hired']);
const survey4Responses = buildResponses(
  MOCK_SURVEYS[3],
  survey4Pool,
  0.75,
  new Date('2025-12-01'),
  new Date('2026-05-31'),
  rng2025
);

export const MOCK_SURVEY_RESPONSES: MockSurveyResponse[] = [
  ...survey1Responses,
  ...survey2Responses,
  ...survey3Responses,
  ...survey4Responses,
];
