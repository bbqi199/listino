"""
量化选股系统 - GitHub发布脚本
"""
import subprocess, os, sys, io
from datetime import datetime

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HTML_FILE = 'quant_stock.html'
GITHUB_URL = 'https://bbqi199.github.io/ECO-SHOP/quant_stock.html'

def main():
    print('=' * 50)
    print('🚀 量化选股系统 - GitHub发布工具')
    print('=' * 50)
    
    if not os.path.exists(HTML_FILE):
        print(f'❌ 找不到文件：{HTML_FILE}')
        input('按回车键退出...')
        sys.exit(1)
    
    print(f'✅ 找到文件：{HTML_FILE}')
    
    print('\n📦 开始Git操作...')
    
    try:
        subprocess.run(['git', 'add', HTML_FILE], check=True)
        print('✅ git add 完成')
        
        now = datetime.now().strftime('%Y-%m-%d %H:%M')
        commit_msg = f'更新量化选股系统 {now}'
        
        status = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
        if not status.stdout.strip():
            print('ℹ️ 没有需要提交的变更')
            print(f'\n🎉 发布完成！线上地址：{GITHUB_URL}')
            input('\n按回车键退出...')
            return
        
        subprocess.run(['git', 'commit', '-m', commit_msg], check=True)
        print(f'✅ git commit: {commit_msg}')
        
        print('\n📤 推送到GitHub...')
        result = subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, text=True)
        if result.returncode != 0:
            result = subprocess.run(['git', 'push', 'origin', 'master'], capture_output=True, text=True)
        
        if result.returncode == 0:
            print('\n🎉 发布成功！')
            print(f'   线上地址：{GITHUB_URL}')
            print('   注意：GitHub Pages 可能需要 1-2 分钟才能同步更新')
        else:
            print(f'⚠️ 推送失败：{result.stderr}')
        
    except Exception as e:
        print(f'❌ 失败：{e}')
    
    input('\n按回车键退出...')

if __name__ == '__main__':
    main()
