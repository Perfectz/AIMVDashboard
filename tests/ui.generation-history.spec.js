const { test, expect } = require('@playwright/test');

const PROJECT_ID = 'demo-project';

function buildIndexPayload() {
  return {
    totalShots: 1,
    totalPrompts: 1,
    tools: {
      kling: 0,
      nanobanana: 0,
      suno: 0,
      seedream: 1
    },
    allPrompts: [
      {
        path: 'prompts/seedream/shot_01_A.txt',
        lintStatus: 'PASS',
        lintErrors: 0,
        tool: 'seedream',
        shotId: 'SHOT_01',
        variation: 'A'
      }
    ],
    shots: [
      {
        shotId: 'SHOT_01',
        variations: {
          seedream: [
            {
              path: 'prompts/seedream/shot_01_A.txt',
              lintStatus: 'PASS',
              lintErrors: 0,
              variation: 'A'
            }
          ],
          kling: [],
          nanobanana: [],
          suno: []
        }
      }
    ]
  };
}

function buildShotRendersPayload() {
  return {
    success: true,
    renders: {
      seedream: {
        A: {
          first: null,
          last: null,
          refs: []
        }
      }
    },
    resolved: {
      seedream: {
        A: {
          first: {
            source: 'none',
            path: null,
            reason: 'missing_previous_last'
          }
        }
      }
    },
    continuity: {
      seedream: {
        enabled: true,
        byVariation: {
          A: {
            reason: 'missing_previous_last'
          }
        }
      }
    }
  };
}

function buildMetricsPayload(runningCount = 0) {
  return {
    success: true,
    metrics: {
      counts: {
        completed: 3,
        failed: 1,
        canceled: 0,
        running: runningCount,
        queued: 0
      },
      successRate: 75,
      avgDurationSec: 18.2
    }
  };
}

async function mockShotPageApis(page, options = {}) {
  const jobsProvider = typeof options.jobsProvider === 'function'
    ? options.jobsProvider
    : () => [];
  const metricsProvider = typeof options.metricsProvider === 'function'
    ? options.metricsProvider
    : () => buildMetricsPayload(0);

  await page.route('**/api/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        projects: [
          {
            id: PROJECT_ID,
            name: 'Demo Project',
            description: 'UI test fixture'
          }
        ]
      })
    });
  });

  await page.route('**/api/auth/github/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: false,
        username: '',
        scopes: [],
        tokenSource: 'none'
      })
    });
  });

  await page.route('**/api/generate-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: true,
        tokenSource: 'session'
      })
    });
  });

  await page.route('**/prompts_index.json*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildIndexPayload())
    });
  });

  await page.route('**/prompts/seedream/shot_01_A.txt*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: [
        '--- SEEDREAM PROMPT ---',
        'Cinematic close-up of the lead singer under practical stage lights.',
        '',
        '--- FIRST FRAME ---',
        'Opening still frame description.',
        '',
        '--- LAST FRAME ---',
        'Ending still frame description.',
        '',
        '--- NEGATIVE PROMPT ---',
        'No distortion, no extra limbs.',
        '',
        '--- DIRECTOR NOTES ---',
        'Keep continuity and warm tones.'
      ].join('\n')
    });
  });

  await page.route('**/api/storyboard/previs-map*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, map: {} })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        entry: {
          sourceType: 'manual',
          sourceRef: '',
          notes: '',
          locked: false,
          continuityDisabled: false
        }
      })
    });
  });

  await page.route('**/api/shot-renders*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildShotRendersPayload())
    });
  });

  await page.route('**/api/generation-jobs*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/generation-jobs/metrics') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(metricsProvider(url, route.request()))
      });
      return;
    }

    if (url.pathname === '/api/generation-jobs') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobs: jobsProvider(url, route.request())
        })
      });
      return;
    }

    await route.continue();
  });
}

test.describe('Generation history phase-3 wrap-up', () => {
  test('details modal, row cancel, and retry-with-overrides call expected endpoints', async ({ page }) => {
    const historyJobs = [
      {
        jobId: 'job_failed_001',
        projectId: PROJECT_ID,
        type: 'generate-shot',
        status: 'failed',
        createdAt: '2026-02-15T08:15:00.000Z',
        startedAt: '2026-02-15T08:15:01.000Z',
        finishedAt: '2026-02-15T08:15:14.000Z',
        input: {
          shotId: 'SHOT_01',
          variation: 'A',
          requireReference: false,
          maxImages: 1,
          previewOnly: true,
          aspect_ratio: '16:9'
        },
        result: {
          shotId: 'SHOT_01',
          variation: 'A',
          referenceCount: 0
        },
        error: {
          code: 'MODEL_TIMEOUT',
          message: 'SeedDream timed out'
        },
        events: [
          {
            event: 'job_failed',
            timestamp: '2026-02-15T08:15:14.000Z',
            error: {
              code: 'MODEL_TIMEOUT',
              message: 'SeedDream timed out'
            }
          }
        ]
      },
      {
        jobId: 'job_running_001',
        projectId: PROJECT_ID,
        type: 'generate-shot',
        status: 'running',
        createdAt: '2026-02-15T08:16:00.000Z',
        startedAt: '2026-02-15T08:16:01.000Z',
        input: {
          shotId: 'SHOT_01',
          variation: 'A',
          requireReference: true,
          maxImages: 2,
          previewOnly: true,
          aspect_ratio: '16:9'
        },
        result: null,
        events: []
      }
    ];

    let cancelRequestCount = 0;
    let retryRequestPayload = null;

    await mockShotPageApis(page, {
      jobsProvider: () => historyJobs,
      metricsProvider: () => buildMetricsPayload(1)
    });

    await page.route('**/api/generation-jobs/*/cancel', async (route) => {
      cancelRequestCount += 1;
      const jobId = route.request().url().split('/').slice(-2, -1)[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          jobId,
          status: 'cancel_requested'
        })
      });
    });

    await page.route('**/api/generation-jobs/*/retry', async (route) => {
      retryRequestPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Retry intentionally failed in UI test fixture'
        })
      });
    });

    await page.goto('/index.html');

    await expect(page.locator('#generationHistorySection')).toBeVisible();
    await expect(page.locator('#generationHistoryList .generation-history-item')).toHaveCount(2);

    const runningRow = page
      .locator('#generationHistoryList .generation-history-item')
      .filter({ hasText: /running/i })
      .first();
    await runningRow.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => cancelRequestCount).toBe(1);

    const failedRow = page
      .locator('#generationHistoryList .generation-history-item')
      .filter({ hasText: /failed/i })
      .first();
    await failedRow.getByRole('button', { name: 'Details' }).click();

    await expect(page.locator('#generationJobDetailsModal')).toBeVisible();
    await expect(page.locator('#generationJobInputJson')).toContainText('"shotId": "SHOT_01"');
    await expect(page.locator('#generationJobFailureJson')).toContainText('MODEL_TIMEOUT');

    await page.selectOption('#generationRetryVariation', 'B');
    await page.fill('#generationRetryMaxImages', '2');
    await page.selectOption('#generationRetryAspectRatio', '9:16');
    await page.check('#generationRetryRequireReference');
    await page.uncheck('#generationRetryPreviewOnly');
    await page.click('#generationJobRetryOverrideBtn');

    await expect.poll(() => retryRequestPayload).not.toBeNull();
    expect(retryRequestPayload).toMatchObject({
      projectId: PROJECT_ID,
      overrides: {
        variation: 'B',
        maxImages: 2,
        aspect_ratio: '9:16',
        requireReference: true,
        previewOnly: false
      }
    });
  });

  test('history auto-refreshes while active jobs exist', async ({ page }) => {
    let listCallCount = 0;

    await mockShotPageApis(page, {
      jobsProvider: () => {
        listCallCount += 1;
        return [
          {
            jobId: 'job_running_auto_001',
            projectId: PROJECT_ID,
            type: 'generate-shot',
            status: 'running',
            createdAt: '2026-02-15T08:20:00.000Z',
            startedAt: '2026-02-15T08:20:01.000Z',
            input: {
              shotId: 'SHOT_01',
              variation: 'A',
              requireReference: true,
              maxImages: 2,
              previewOnly: true
            },
            result: null,
            events: []
          }
        ];
      },
      metricsProvider: () => buildMetricsPayload(1)
    });

    await page.goto('/index.html');

    await expect(page.locator('#generationHistorySection')).toBeVisible();
    await expect(page.locator('#generationHistoryList .generation-history-item')).toHaveCount(1);

    await expect
      .poll(() => listCallCount, { timeout: 15000 })
      .toBeGreaterThan(1);
  });
});
