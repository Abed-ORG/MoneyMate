import pathlib

files = [
    "tests/test_budgets_unit.py",
    "tests/test_integration.py",
    "tests/test_transactions_unit.py",
]

for file_path in files:
    lines = pathlib.Path(file_path).read_text().splitlines()
    # strip trailing whitespace from each line
    lines = [line.rstrip() for line in lines]
    # remove any trailing empty lines
    while lines and lines[-1] == "":
        lines.pop()
    # write back ensuring exactly one trailing newline
    pathlib.Path(file_path).write_text("\n".join(lines) + "\n")
    print(f"Fixed {file_path}")