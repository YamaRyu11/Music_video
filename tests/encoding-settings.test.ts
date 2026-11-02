import {it,expect} from 'vitest';
import {defaultEncoding,encodingPresets,estimatedMegabytes,validEncoding} from '../src/export/settings';
import {encoderArguments} from '../electron/encoder';
it('accepts presets and rejects untrusted encoder fields',()=>{
 expect(validEncoding({...defaultEncoding,crf:20.5})).toBe(true);
 for(const p of encodingPresets)expect(validEncoding(p.settings)).toBe(true);
 for(const patch of [{mode:'shell'},{crf:13},{crf:NaN},{videoBitrate:Infinity},{videoBitrate:51},{audioBitrate:999},{preset:'-y'}])expect(validEncoding({...defaultEncoding,...patch})).toBe(false);
 expect(()=>encoderArguments('a','b',1,'landscape',{...defaultEncoding,preset:'-y' as never})).toThrow();
});
it('selects either CRF or average bitrate and estimates audio-inclusive size',()=>{
 const quality=encoderArguments('a','b',1,'landscape',{...defaultEncoding,crf:17,audioBitrate:320,preset:'medium'});
 expect(quality).toContain('17');expect(quality).toContain('320k');expect(quality).toContain('medium');expect(quality).not.toContain('-b:v');
 const options={...defaultEncoding,mode:'bitrate' as const,videoBitrate:8};const bitrate=encoderArguments('a','b',1,'portrait',options);
 expect(bitrate).toContain('8M');expect(bitrate).not.toContain('-crf');expect(estimatedMegabytes(options,60)).toBeCloseTo(59.05,1);expect(estimatedMegabytes(defaultEncoding,60)).toBeUndefined();
});
