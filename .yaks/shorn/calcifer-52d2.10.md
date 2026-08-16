---
id: calcifer-52d2.10
title: 'Scheduling: cron-based multi-source polling'
type: task
priority: 2
created: '2026-06-23T21:15:32Z'
updated: '2026-06-23T21:46:33Z'
parent: calcifer-52d2
---

Wire all monitors into NanoClaw schedule_task. Different frequencies per source: StreetEasy 5-10 min, Compass 30 min, Craigslist 15 min (or RSS push), management sites 1-2 hr with morning 10am peak run, agent pages 4 hr. Use script hook to only wake agent when new listings found.
