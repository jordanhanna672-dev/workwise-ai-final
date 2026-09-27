# Getting this project onto GitHub (Mac-friendly, beginner steps)

This guide assumes you've never used Git or GitHub before, and that you're
on a Mac. It covers the one tricky part: this project includes a folder
named `.github` (with a leading period), which Finder does **not** let you
create normally — but that's completely fine, because you'll never create it
by hand. It already exists in the project, and Git/Terminal handle it
without any issue.

## Why does a folder starting with "." matter?

On Mac, any file or folder whose name starts with a period (`.`) is treated
as "hidden" by Finder — that's a Finder convention, not a Git or GitHub
rule. `.github`, `.gitignore`, and `.env.example` are all normal, valid
folder/file names everywhere else (Terminal, GitHub, your code editor). You
don't need to create them yourself for this project — they're already
there — but if you ever need to see them in Finder, press:

```
Cmd + Shift + .
```

That toggles hidden files on/off in any Finder window. You do **not** need
to do this to complete the steps below — Terminal and Git already see
these files/folders regardless of Finder's setting.

## Step 1 — Install Git (if you don't have it)

Open Terminal and type:

```
git --version
```

If it's not installed, macOS will prompt you to install the "Command Line
Developer Tools" — click Install and wait for it to finish, then run the
command again to confirm.

## Step 2 — Tell Git who you are (one-time setup)

```
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## Step 3 — Create the repository on GitHub.com

1. Go to <https://github.com> and log in (or sign up).
2. Click the **+** icon (top right) → **New repository**.
3. Name it, e.g., `workwise-ai`.
4. Leave "Add a README", "Add .gitignore", and "Add license" **unchecked** —
   this project already has those files, and checking them can cause
   conflicts.
5. Click **Create repository**.
6. Copy the URL shown under "…or push an existing repository from the
   command line" — it looks like `https://github.com/your-username/workwise-ai.git`.

## Step 4 — Push this project to that repository

In Terminal, `cd` into the project folder (the one containing this file),
then run these commands one at a time:

```
git init
git add .
git commit -m "Final release (v1.0.0): WorkWise AI"
git branch -M main
git remote add origin https://github.com/your-username/workwise-ai.git
git push -u origin main
```

Replace the URL in the `git remote add origin ...` line with the one you
copied in Step 3.

If it asks you to log in, GitHub no longer accepts your account password
directly from the command line — it will either open a browser window to
sign in, or ask for a **Personal Access Token**. If you're prompted for a
token and don't have one: on GitHub.com go to **Settings → Developer
settings → Personal access tokens → Generate new token**, give it "repo"
access, copy it, and paste it in place of a password when asked.

## Step 5 — Tag this as the v1.0.0 release

Grading criteria for a final release usually asks for a tagged version,
not just a commit — a tag is a permanent, named bookmark for exactly this
point in the project's history, and it's what shows up as a "release" on
GitHub. Right after the push above succeeds, run:

```
git tag -a v1.0.0 -m "Final release: WorkWise AI"
git push origin v1.0.0
```

Then on GitHub.com, go to your repository's page and click **Releases**
(usually in the right-hand sidebar, or under the "tags" link near the
branch dropdown) — you should see `v1.0.0` listed. Optionally click
**Draft a new release**, pick the `v1.0.0` tag, and GitHub will let you
add release notes (the top of `CHANGELOG.md` is a good starting point to
paste in).

## Step 6 — Verify it worked

Refresh the repository page on GitHub.com. You should see all the project
files listed, including `.github` (GitHub's file browser shows dot-folders
by default — no special step needed).

To double check the `.github/workflows/ci.yml` file made it up (this is
what runs the automated tests on GitHub itself), click the **Actions** tab
on your repository page. You should see a workflow run either already
finished or in progress.

## Common snags

- **"git: command not found"** → Git isn't installed yet; see Step 1.
- **"fatal: not a git repository"** → you're not inside the project folder;
  run `pwd` to check where you are, and `cd` to the right folder.
- **"remote origin already exists"** → you already ran `git remote add`
  once; run `git remote set-url origin <url>` instead to fix the URL.
- **Nothing shows up under `.github` on GitHub.com** → make sure you ran
  `git add .` (with the period) and not `git add *`, since some shells
  expand `*` in a way that skips dot-folders. `git add .` always includes
  them.
