// Run every five minutes from the company's server scheduler. Secrets stay in env.
const base = process.env.DUTY_SITE_URL;
const token = process.env.TASK_SCHEDULER_TOKEN;
if (!base || !token) throw new Error('Set DUTY_SITE_URL and TASK_SCHEDULER_TOKEN in the scheduler environment.');
const url = new URL('/api/tasks/tick', base);
if (url.protocol !== 'https:') throw new Error('HTTPS is required.');
const response = await fetch(url, {method:'POST',headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(60000)});
if (!response.ok) throw new Error('Task scheduler failed: HTTP '+response.status);
console.log('Task scheduler completed.', await response.json());
