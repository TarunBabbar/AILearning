import { getConfig } from '../shared/lib/config.ts';
import { readTestCaseFile } from '../agents/test-case-gen/agent.ts';
import { approveAll, approveCase, listPendingCases, summarize, type ReviewSummary } from './approval.ts';

const HELP = `Review generated test cases (approval gate before codegen).

Usage:
  node scripts/review.ts list [screenId]
  node scripts/review.ts approve <screenId> <caseId>
  node scripts/review.ts approve-all <screenId>
  node scripts/review.ts status <screenId>

Examples:
  node scripts/review.ts list checkout
  node scripts/review.ts approve checkout checkout-tc-1
  node scripts/review.ts approve-all checkout
`;

function main(): void {
  const cfg = getConfig();
  const [cmd, a, b] = process.argv.slice(2);

  switch (cmd) {
    case 'list': {
      const files = a ? [readTestCaseFile(`${cfg.specsDir}/tests/${a}.tests.yaml`)] : listPendingCases(cfg);
      for (const f of files) {
        const s = summarize(f);
        console.log(`\n${f.screenId} (${f.provider}) — ${s.approved}/${s.total} approved`);
        for (const c of f.cases) {
          const rc = c as { review?: string };
          console.log(`  [${rc.review ?? 'pending'}] ${c.id}  ${c.title} (${c.priority})`);
          console.log(`      ${c.scenario}`);
        }
      }
      console.log('\nApprove: node scripts/review.ts approve <screenId> <caseId>');
      return;
    }
    case 'approve': {
      if (!a || !b) return void console.log('usage: review.ts approve <screenId> <caseId>');
      const s: ReviewSummary = approveCase(cfg, a, b, 'approved');
      console.log(s);
      return;
    }
    case 'approve-all': {
      if (!a) return void console.log('usage: review.ts approve-all <screenId>');
      const s: ReviewSummary = approveAll(cfg, a);
      console.log(s);
      return;
    }
    case 'status': {
      if (!a) return void console.log('usage: review.ts status <screenId>');
      const f = readTestCaseFile(`${cfg.specsDir}/tests/${a}.tests.yaml`);
      console.log(summarize(f));
      return;
    }
    default:
      console.log(HELP);
  }
}

main();
