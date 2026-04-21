# Setting Up GitHub Repository

Follow these steps to push opentab_ to GitHub.

## Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click **New Repository**
3. Name: `opentab`
4. Description: `Survey data cross-tabulation tool with drag-and-drop interface`
5. Choose: **Public** (for open source)
6. **Do NOT** initialize with README (we have one)
7. Click **Create Repository**

## Step 2: Initialize Git Locally

In the project root (`C:\Users\stvjr\Documents\tabulator`):

```bash
git init
git add .
git commit -m "Initial commit: opentab_ - survey data crosstab tool"
git branch -M main
git remote add origin https://github.com/steviejrdn/opentab.git
git push -u origin main
```



## Step 3: Verify

1. Go to `https://github.com/steviejrdn/opentab`
2. Check that all files are uploaded
3. README.md should display nicely

## Step 4: (Optional) Setup GitHub Pages

For documentation site:

1. Go to repo **Settings** → **Pages**
2. Source: **Deploy from branch**
3. Branch: **main** / **/(root)**
4. Save

Docs will be at `https://steviejrdn.github.io/opentab/`

## Step 5: Add Topics (GitHub)

In repo **Settings** → **Topics**, add:
- `survey`
- `crosstab`
- `data-analysis`
- `react`
- `fastapi`
- `docker`
- `opensource`

This helps people discover opentab_.

## Next Steps

- **Share**: Post repo link on Twitter, Reddit, HN, etc.
- **Docs**: Pin README.md and CONTRIBUTING.md
- **Releases**: Tag releases (v0.1.0, v0.2.0, etc.)
- **Issues**: Enable discussions for Q&A

## Push New Changes

After making changes locally:

```bash
git add .
git commit -m "feat: your change description"
git push origin main
```

## Branching for Features

For new features:

```bash
git checkout -b feat/your-feature
# make changes
git commit -m "feat: description"
git push origin feat/your-feature
# Open PR on GitHub
```

---

**That's it!** Your project is now on GitHub and ready for the world. 🚀
