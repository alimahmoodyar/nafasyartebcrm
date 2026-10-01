# Push source via SSH

This environment could not resolve github.com for SSH; the connected GitHub app returned 403 when writing. **No GitHub push has been completed by this environment.**

The handoff ZIP contains a Git bundle and `push-github.ps1`. It does not contain private keys, production records, database exports, or runtime secrets. The public key must be authorized for writing to `alimahmoodyar/nafasyartebcrm` in GitHub, either on the account or as a write-enabled deploy key.

On Windows with Git installed, extract the handoff ZIP. Open PowerShell in that directory and run (use your actual key path):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\push-github.ps1 -KeyPath "C:\Users\Ali\.ssh\ali" -BundlePath .\nafasyar.bundle
```

This extracts source into a new temporary working directory and pushes `main` over SSH without force. If GitHub already has unrelated commits, it stops instead of overwriting them. On the first SSH connection verify GitHub's host fingerprint using GitHub's official documentation. A passphrase-protected key may prompt locally.

Manual alternative:

```powershell
git clone --branch main .\nafasyar.bundle nafasyar-source
cd nafasyar-source
git remote add github git@github.com:alimahmoodyar/nafasyartebcrm.git
$env:GIT_SSH_COMMAND = 'ssh -i "C:/Users/Ali/.ssh/ali" -o IdentitiesOnly=yes'
git push github main:main
```

Uploading source is not deploying a running application. The site hosting and GitHub remote are separate. Runtime secrets stay in the hosting environment.
