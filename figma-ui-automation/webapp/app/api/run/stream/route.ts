import { getRun, subscribe } from '@/lib/pipeline-runner';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');
  if (!runId) return new Response('missing runId', { status: 400 });

  const run = getRun(runId);
  if (!run) return new Response('run not found', { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'log', line: chunk })}\n\n`));
        } catch {
          /* client gone */
        }
      };
      const unsubscribe = subscribe(run, send);

      // if already finished, close immediately after flush
      if (run.finished) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', exitCode: run.exitCode })}\n\n`));
        controller.close();
        unsubscribe();
        return;
      }

      const doneSent = () => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', exitCode: run.exitCode })}\n\n`));
        } catch {
          /* ignore */
        }
        controller.close();
        unsubscribe();
      };
      run.listeners.add(doneSent);
      run.child.once('close', doneSent);
    },
    cancel() {
      /* client disconnected; let the run continue server-side */
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
