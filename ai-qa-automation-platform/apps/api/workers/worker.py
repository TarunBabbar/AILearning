"""Temporal worker entrypoint — registers all workflows + activities.

Run: python -m workers.worker   (one process per queue in prod)
"""
import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from app.config import settings
from app.jobs import workflows
from app.jobs.activities import (
    generate_tests_activity,
    run_suite_activity,
)


async def main() -> None:
    client = await Client.connect(settings.temporal_address)
    worker = Worker(
        client,
        task_queue="qa-platform",
        workflows=[workflows.GenerateTestsWorkflow, workflows.RunSuiteWorkflow],
        activities=[generate_tests_activity, run_suite_activity],
    )
    print(f"Temporal worker started (queue=qa-platform, address={settings.temporal_address})")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
