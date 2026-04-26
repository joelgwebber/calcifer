#!/bin/bash
# Run yak from YAK_PROJECT_DIR if set (used by the main Calcifer agent to
# write tasks to the host project's .yaks/), otherwise from the current directory
# (used by project build agents running in their own workspace).
cd "${YAK_PROJECT_DIR:-$PWD}"
exec yak "$@"
