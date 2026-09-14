import {build} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
await build({configFile:false,root:process.cwd(),resolve:{alias:{'@':process.cwd()}},plugins:[react()],build:{outDir:path.resolve('../backend/wwwroot'),emptyOutDir:true}});
