# PetHealth — Instructions for Claude Code

This file is read automatically by Claude Code every session. It tells you (Claude Code) how this two-person team — Samih and Hani — works together on this repo. Follow these rules on every task without being reminded.

Full explainer for the humans: see the team SOP guide.

## Golden rule

Never make changes, commit, or push while sitting on `main`. All work happens on a branch. If you're ever about to run a git command and you're not sure what branch you're on, run `git branch` first and confirm before doing anything else.

## Starting any new task

Before writing or changing a single line of code:

1. Run `git checkout main`
2. Run `git pull origin main`
3. Create a new branch off the latest main: `git checkout -b <type>/<short-description>`

Branch naming — pick the right prefix:
- `feature/...` — new functionality (e.g. `feature/vaccine-reminders`)
- `fix/...` — bug fixes (e.g. `fix/login-crash`)
- `chore/...` — maintenance, deps, config (e.g. `chore/update-dependencies`)

One branch = one task. If you notice unrelated work worth doing while on a branch, mention it to the user instead of doing it there — it belongs on its own branch later.

Tell the user which branch you created before starting the actual work.

## While working

- Only touch files relevant to the current task. If a change would require editing something outside that scope, stop and ask the user first — unrelated edits are the main cause of overlap with the other person's work.
- When asked to make a change, briefly explain what you changed and why once it's done. Both team members are beginners — favor clear, plain-English explanations over jargon.

## Committing progress

- Commit in small, frequent chunks — after each meaningful piece of work, not just once at the end.
- Before committing, show the user what changed (`git diff` or a plain-English summary).
- Write clear, descriptive commit messages summarizing what the change does, e.g. `Add vaccine reminder form validation`, not `updates` or `fixes`.

## Opening a Pull Request

Once a branch does one complete, working piece of work — open a Pull Request. Don't wait for the whole feature/epic to be "finished"; smaller PRs are easier to review.

1. `git push origin <branch-name>`
2. `gh pr create --title "<clear title>" --body "<what changed and why>"`
3. Add the other team member as a reviewer if the `gh` command supports it in this environment, or tell the user to do so.
4. Share the PR link with the user when done.

If the `gh` CLI isn't installed or authenticated, tell the user clearly and point them to run `gh auth login` — don't try to work around it.

## Never merge a PR without the other team member's approval

A Pull Request must be reviewed and approved by the **other** team member — not the person who wrote it — before it merges. This is the entire point of using PRs on a two-person team, so it is not optional and is never satisfied by the current user simply telling you "go ahead."

Before running `gh pr merge`, always:

1. Run `gh pr view <number> --json reviews,author` (or equivalent) to check who opened the PR and whether it has an approving review from someone else.
2. If there is no approval from the other team member yet, tell the user this plainly and do not merge — suggest they ask the other person to review it first.
3. Only proceed to merge once you've confirmed an approval exists from someone other than the PR's author, **and** the current user has explicitly confirmed they want to merge now.

If you cannot check review status for any reason (permissions, tool limits), say so and ask the user to confirm approval status themselves before merging — never assume it's been reviewed.

## Handling overlaps with the other person's work (merge conflicts)

When asked to bring `main` up to date on a branch:

1. `git checkout main && git pull origin main`
2. `git checkout <branch-name>`
3. `git merge main`
4. If conflicts appear, show the user exactly what differs on both sides for each conflicted file before resolving anything. Never silently pick one side.

## Actions that always require explicit user confirmation first

These are hard to undo cleanly, so stop and describe the plan before doing any of them — even if the user's earlier instruction seems to imply it:

- Merging a Pull Request (`gh pr merge`) — and only after confirming the other team member's approval, per the section above
- Pushing directly to `main`
- Force-pushing (`git push --force` / `--force-with-lease`)
- Deleting a branch that has unmerged work
- Discarding uncommitted changes (`git checkout --`, `git reset --hard`, `git clean`)

Everything else in this file — branching, committing, opening a PR — can proceed without asking each time, since none of it changes `main` until a human approves the merge.

## Tone

Both team members are new to Git, GitHub, and Claude Code. Prefer plain language over jargon, and briefly explain *why* a step matters the first time it comes up in a session, not just what command was run.