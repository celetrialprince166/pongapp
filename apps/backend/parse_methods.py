import os

def parse_methods(input_file, output_file):
    methods_by_file = {}
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            for line in f:
                # Ensure line is valid utf-8 and strip null bytes if any
                line = line.replace('\0', '')
                parts = line.split(':', 1)
                if len(parts) == 2:
                    filepath = parts[0].strip()
                    method_def = parts[1].strip()
                    
                    if filepath not in methods_by_file:
                        methods_by_file[filepath] = []
                    methods_by_file[filepath].append(method_def)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# Backend Methods\n\n")
            for filepath in sorted(methods_by_file.keys()):
                f.write(f"## `{filepath}`\n\n")
                f.write("```python\n")
                for method in methods_by_file[filepath]:
                    f.write(f"{method}\n")
                f.write("```\n\n")
    except Exception as e:
        print(f"Error parsing file: {e}")

if __name__ == "__main__":
    parse_methods('backend_methods.txt', 'backend_methods.md')
