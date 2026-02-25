# Opening a Pull Request to Upstream (Stellar-Tools/Stellar-AgentKit)

If you develop on a fork and want to contribute back to the upstream repository, follow these steps.

---

## 1. Remotes

- **origin** – your fork (e.g. `https://github.com/SuleymanEmirGergin/Stellar-AgentKit.git`)
- **upstream** – upstream repo: `https://github.com/Stellar-Tools/Stellar-AgentKit.git`

```bash
git remote -v
# Add upstream if missing:
git remote add upstream https://github.com/Stellar-Tools/Stellar-AgentKit.git
```

---

## 2. Branch from upstream (recommended)

To avoid “entirely different commit histories” on GitHub:

1. Fetch upstream and create a branch from it:

   ```bash
   git fetch upstream
   git checkout -b my-feature upstream/main
   ```

2. Bring your changes in (choose one):

   - **Merge your fork’s branch** (keeps history):

     ```bash
     git merge origin/emir-ci-fix --no-edit
     ```

   - **Cherry-pick specific commits** from your branch:

     ```bash
     git log origin/emir-ci-fix --oneline
     git cherry-pick <commit-hash>
     ```

3. Resolve conflicts if any, then push the new branch to **your fork**:

   ```bash
   git push -u origin my-feature
   ```

4. On GitHub: open **Stellar-Tools/Stellar-AgentKit** → **Pull requests** → **New pull request**  
   - Base: **Stellar-Tools/Stellar-AgentKit** `main`  
   - Compare: **SuleymanEmirGergin/Stellar-AgentKit** `my-feature`  
   - Create the PR.

---

## 3. If you already pushed unrelated history to your fork

GitHub will not show “Create pull request” when base and head have no common history. You must use a branch that is based on `upstream/main` (as in step 2) and then push that branch to your fork to open a PR.

---

## 4. After the PR

- Keep `my-feature` in sync with upstream if requested (e.g. `git fetch upstream && git rebase upstream/main`).
- Do not force-push to a branch that is already used in an open PR unless you are sure (prefer new commits or rebase only on your own branch before opening the PR).
