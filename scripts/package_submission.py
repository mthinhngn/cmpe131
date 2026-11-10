"""Build a source-only hand-in archive outside the checkout."""
from pathlib import Path
import os
import zipfile


EXCLUDED_DIRS = {
    '.git', '.agents', '.codex', '.impeccable', '.playwright-mcp', '.references',
    '.taste-skill', '.vercel', '.venv', 'venv', 'node_modules', 'dist',
    '__pycache__', 'tmp', 'exports', 'work',
}


def included(relative: Path) -> bool:
    if any(part in EXCLUDED_DIRS for part in relative.parts):
        return False
    name = relative.name
    if name == 'AGENTS.md' or name == '.env' or name.startswith('.env.') and name != '.env.example':
        return False
    if name.endswith(('.pyc', '.pyo', '.tsbuildinfo', '.log', '.zip')):
        return False
    if relative.parts[:2] in {('api', 'generated'), ('api', 'coverage')}:
        return False
    if relative.parts[:2] == ('data', 'sjsu') and any(part in {'sources', 'courses'} for part in relative.parts[2:]):
        return False
    return True


def build(root: Path, destination: Path) -> int:
    root = root.resolve()
    destination = destination.resolve()
    if destination.is_relative_to(root):
        raise ValueError('Keep the submission archive outside the source checkout.')
    count = 0
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, strict_timestamps=False) as archive:
        for folder, dirs, files in os.walk(root):
            dirs[:] = sorted(name for name in dirs if included((Path(folder) / name).relative_to(root))
                             and not (Path(folder) / name).is_symlink())
            for name in sorted(files):
                path = Path(folder) / name
                relative = path.relative_to(root)
                if included(relative) and not path.is_symlink():
                    archive.write(path, Path('CourseRadar') / relative)
                    count += 1
    return count


if __name__ == '__main__':
    project = Path(__file__).resolve().parents[1]
    output = project.parent / 'CourseRadar-submission.zip'
    total = build(project, output)
    print(f'Packaged {total} source files: {output}')
