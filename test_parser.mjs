import { parseJobsFromFile } from './parser.js';

async function testParser() {
  try {
    const jobs = await parseJobsFromFile('6+ Years - 20-July.pdf');
    console.log('Parsed jobs:', jobs);
    console.log('Number of jobs:', jobs.length);
  } catch (e) {
    console.error('Error parsing jobs:', e.message);
  }
}

testParser();