import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('submission', Path(__file__).resolve().parents[1] / 'package_submission.py')
submission = importlib.util.module_from_spec(spec)
spec.loader.exec_module(submission)


class SubmissionPackageTests(unittest.TestCase):
    def test_archive_keeps_source_and_examples_but_omits_secrets_and_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / 'project'
            keep = ['README.md', 'api/.env.example', '.env.example', 'public/showcase/base.js',
                    'api/prisma/migrations/initial/migration.sql', 'data/sjsu/2026-2027/programs/normalized.json']
            omit = ['.env', '.env.local', 'api/.env', '.git/config', '.agents/skills/private.md',
                    'node_modules/module/index.js', 'tmp/session.log', 'api/generated/users/index.js',
                    'api/dist/main.js', 'data/sjsu/2026-2027/programs/sources/program.html']
            for name in keep + omit:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text('fixture', encoding='utf-8')
            archive = base / 'submission.zip'
            self.assertEqual(submission.build(root, archive), len(keep))
            with zipfile.ZipFile(archive) as result:
                self.assertEqual(set(result.namelist()), {'CourseRadar/' + name for name in keep})
            with self.assertRaises(ValueError):
                submission.build(root, root / 'recursive.zip')
