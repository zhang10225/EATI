import { BloomRevocationList } from '../../src/vanet/BloomRevocationList';
import { BloomFilterExport } from '../../src/vanet/types';

describe('BloomRevocationList', () => {
    // 使用较小的 filter 便于测试（8,192 bits = 1 KB）
    let brl: BloomRevocationList;

    beforeEach(() => {
        brl = new BloomRevocationList(8192, 7);
    });

    describe('add / mightBeRevoked', () => {
        it('should return false for empty filter', () => {
            expect(brl.mightBeRevoked('any-cert-serial')).toBe(false);
        });

        it('should detect a revoked certificate after adding it', () => {
            brl.add('cert-serial-001');
            expect(brl.mightBeRevoked('cert-serial-001')).toBe(true);
        });

        it('should detect all added certificates', () => {
            const serials = ['serial-A', 'serial-B', 'serial-C', 'serial-D'];
            serials.forEach(s => brl.add(s));
            serials.forEach(s => expect(brl.mightBeRevoked(s)).toBe(true));
        });

        it('should not flag clearly different certificate serials in small filter', () => {
            // 在空 filter 中，一个未添加的条目应返回 false
            brl.add('cert-serial-001');
            // 使用完全不同的序列号，避免碰撞
            expect(brl.mightBeRevoked('')).toBe(false);
        });

        it('should track count of added entries', () => {
            expect(brl.getCount()).toBe(0);
            brl.add('serial-1');
            brl.add('serial-2');
            brl.add('serial-3');
            expect(brl.getCount()).toBe(3);
        });
    });

    describe('false positive rate estimation', () => {
        it('should return 0 for empty filter', () => {
            expect(brl.estimateFalsePositiveRate()).toBe(0);
        });

        it('should increase FP rate as more entries are added', () => {
            const rateBefore = brl.estimateFalsePositiveRate();
            for (let i = 0; i < 200; i++) {
                brl.add(`serial-${i}`);
            }
            const rateAfter = brl.estimateFalsePositiveRate();
            expect(rateAfter).toBeGreaterThan(rateBefore);
        });

        it('should remain below 1 for reasonable load', () => {
            for (let i = 0; i < 50; i++) {
                brl.add(`serial-${i}`);
            }
            expect(brl.estimateFalsePositiveRate()).toBeLessThan(1);
        });
    });

    describe('export / import (OTA broadcast simulation)', () => {
        it('should export to compact BloomFilterExport format', () => {
            brl.add('cert-001');
            const exported: BloomFilterExport = brl.export();

            expect(typeof exported.data).toBe('string');
            expect(exported.size).toBe(8192);
            expect(exported.hashCount).toBe(7);
            expect(exported.version).toBe(1);
            expect(exported.timestamp).toBeGreaterThan(0);
        });

        it('should preserve all revocations after import', () => {
            const serials = ['cert-A', 'cert-B', 'cert-C'];
            serials.forEach(s => brl.add(s));

            const exported = brl.export();
            const imported = BloomRevocationList.import(exported);

            serials.forEach(s => expect(imported.mightBeRevoked(s)).toBe(true));
        });

        it('should not flag entries that were not revoked in original filter', () => {
            brl.add('cert-revoked');

            const exported = brl.export();
            const imported = BloomRevocationList.import(exported);

            // 空 filter 中的条目（在 add 之前是 false 的那些）导入后仍应为 false
            expect(imported.mightBeRevoked('')).toBe(false);
        });

        it('exported filter should be compact compared to a full CRL', () => {
            // 添加 100 条撤销，filter 大小应远小于等效字符串 CRL
            for (let i = 0; i < 100; i++) {
                brl.add(`cert-serial-${i.toString().padStart(10, '0')}`);
            }
            const exported = brl.export();
            const filterSizeBytes = Buffer.from(exported.data, 'base64').length;

            // size=8192 bits → 1024 bytes；远小于 100 条文本 CRL（每条约 30+ bytes = 3000+ bytes）
            expect(filterSizeBytes).toBeLessThanOrEqual(1024 + 10); // base64 overhead margin
        });
    });

    describe('realistic VANET scale', () => {
        it('should handle 1000 revocations with low false positive rate', () => {
            // 使用推荐参数：143,776 bits, k=10，适合 1 万条
            const largeBrl = new BloomRevocationList(143776, 10);
            for (let i = 0; i < 1000; i++) {
                largeBrl.add(`vehicle-cert-${i}`);
            }

            // 验证所有已添加条目都能被检测
            for (let i = 0; i < 1000; i++) {
                expect(largeBrl.mightBeRevoked(`vehicle-cert-${i}`)).toBe(true);
            }

            // 估计 FP 率应低于 0.001（0.1%）
            const fp = largeBrl.estimateFalsePositiveRate();
            expect(fp).toBeLessThan(0.001);

            // 导出大小应在合理范围内（<22 KB）
            const exported = largeBrl.export();
            const bytes = Buffer.from(exported.data, 'base64').length;
            expect(bytes).toBeLessThan(22000);
        });
    });
});
