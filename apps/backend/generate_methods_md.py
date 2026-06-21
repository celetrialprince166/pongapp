import os

def is_binary(file_path):
    try:
        with open(file_path, 'tr') as check_file:
            check_file.read()
            return False
    except:
        return True

def generate_methods_md(root_dir, output_file):
    methods_by_file = {}
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Exclude directories
        dirnames[:] = [d for d in dirnames if d not in ['venv', 'migrations', '__pycache__', '.git', '.idea']]
        
        for filename in filenames:
            if filename.endswith('.py'):
                filepath = os.path.join(dirpath, filename)
                relative_path = os.path.relpath(filepath, root_dir)
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        
                    file_methods = []
                    for line in lines:
                        stripped = line.strip()
                        if stripped.startswith('def ') and stripped.endswith(':'):
                            file_methods.append(stripped)
                            
                    if file_methods:
                        methods_by_file[relative_path] = file_methods
                        
                except Exception as e:
                    print(f"Skipping {filepath}: {e}")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# Backend Methods\n\n")
        for filepath in sorted(methods_by_file.keys()):
            f.write(f"## `{filepath}`\n\n")
            f.write("```python\n")
            for method in methods_by_file[filepath]:
                f.write(f"{method}\n")
            f.write("```\n\n")

if __name__ == "__main__":
    generate_methods_md('backend', 'backend_methods.md')
