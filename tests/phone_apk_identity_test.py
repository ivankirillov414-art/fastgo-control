import importlib.util, tempfile, unittest, zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('apk_identity',Path(__file__).parents[1]/'scripts/check-phone-apk-identity.py');identity=importlib.util.module_from_spec(spec);spec.loader.exec_module(identity)

class IdentityTests(unittest.TestCase):
    def test_signatures_may_differ_but_code_and_resources_must_match(self):
        with tempfile.TemporaryDirectory() as d:
            source,signed=Path(d)/'source.apk',Path(d)/'signed.apk'
            rows={'AndroidManifest.xml':b'manifest','classes.dex':b'code','resources.arsc':b'resources','assets/workshop.html':b'ui'}
            def write(path,changes):
                with zipfile.ZipFile(path,'w') as z:
                    for name,data in (rows|changes).items():z.writestr(name,data)
            write(source,{})
            write(signed,{'META-INF/ANDROID.RSA':b'certificate','META-INF/ANDROID.SF':b'signature'})
            self.assertTrue(identity.compare(source,signed)['all_apk_content_matches_source'])
            for name in rows:
                write(signed,{name:b'stale version'})
                self.assertEqual(identity.compare(source,signed)['changed_entries'],[name])
            write(signed,{'assets/unverified.js':b'added code'})
            self.assertEqual(identity.compare(source,signed)['changed_entries'],['assets/unverified.js'])

if __name__=='__main__':unittest.main()
