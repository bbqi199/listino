# ============================================================
# publish.ps1 — 一键发布 listino.html 到 GitHub
# 目标仓库: https://github.com/bbqi199/listino.git
# 用法: 右键 -> 用 PowerShell 运行，或在终端执行 .\publish.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$REMOTE_URL = "https://github.com/bbqi199/listino.git"
$BRANCH     = "main"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  listino 发布脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 切换到脚本所在目录 ───────────────────────────────────────
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir
Write-Host "[目录] $scriptDir" -ForegroundColor Gray

# ── 检查 git 是否安装 ────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未检测到 git，请先安装 Git for Windows: https://git-scm.com" -ForegroundColor Red
    exit 1
}

# ── 初始化仓库（如果还没有 .git）────────────────────────────
if (-not (Test-Path ".git")) {
    Write-Host "[初始化] git init ..." -ForegroundColor Yellow
    git init
    git checkout -b $BRANCH 2>$null
}

# ── 配置远程地址 ─────────────────────────────────────────────
$existingRemote = git remote 2>$null
if ($existingRemote -contains "origin") {
    git remote set-url origin $REMOTE_URL
    Write-Host "[远程] 已更新 origin -> $REMOTE_URL" -ForegroundColor Gray
} else {
    git remote add origin $REMOTE_URL
    Write-Host "[远程] 已添加 origin -> $REMOTE_URL" -ForegroundColor Gray
}

# ── 创建 / 更新 .gitignore ───────────────────────────────────
$gitignoreContent = @"
# 忽略工作目录配置
.workbuddy/

# 忽略 Python 缓存
__pycache__/
*.pyc

# 忽略 macOS 垃圾文件
.DS_Store
"@
$gitignoreContent | Set-Content -Encoding UTF8 ".gitignore"
Write-Host "[配置] .gitignore 已生成" -ForegroundColor Gray

# ── 添加要发布的文件 ─────────────────────────────────────────
Write-Host ""
Write-Host "[暂存] 添加文件到 git ..." -ForegroundColor Yellow

git add listino.html
if (Test-Path "index.html")  { git add index.html }
if (Test-Path "styles.css")  { git add styles.css }
if (Test-Path "app.js")      { git add app.js }
if (Test-Path "goods.json")  { git add goods.json }
git add .gitignore

# 显示即将提交的内容
Write-Host ""
Write-Host "[状态] 即将提交的文件：" -ForegroundColor Cyan
git status --short

# ── 提交 ─────────────────────────────────────────────────────
Write-Host ""
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$commitMsg = "update: listino 性能优化版 ($timestamp)"

# 检查是否有内容可提交
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "[提示] 没有变更需要提交，文件已是最新状态。" -ForegroundColor Green
} else {
    git commit -m $commitMsg
    Write-Host "[提交] $commitMsg" -ForegroundColor Green
}

# ── 推送到 GitHub ────────────────────────────────────────────
Write-Host ""
Write-Host "[推送] 正在推送到 GitHub ..." -ForegroundColor Yellow
Write-Host "       $REMOTE_URL" -ForegroundColor Gray
Write-Host ""
Write-Host "  ⚠️  如果弹出登录窗口，请用 GitHub 账号 bbqi199 登录" -ForegroundColor Yellow
Write-Host "  ⚠️  推荐使用 Personal Access Token 作为密码（GitHub 已不支持密码登录）" -ForegroundColor Yellow
Write-Host ""

git push -u origin $BRANCH

# ── 完成 ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ 发布成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  仓库地址: https://github.com/bbqi199/listino" -ForegroundColor Cyan
Write-Host "  页面地址: https://bbqi199.github.io/listino/listino.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "  如需启用 GitHub Pages，请到仓库设置:" -ForegroundColor Gray
Write-Host "  Settings -> Pages -> Branch: main -> Save" -ForegroundColor Gray
Write-Host ""
