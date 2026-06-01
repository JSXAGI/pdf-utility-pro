// ==========================================
// 1. ライブラリのインポート（地図から呼び出す）
// ==========================================
import * as pdfjsModule from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import * as docx from 'docx';
import JSZip from 'jszip';

// 【修正の要】箱（default）に入って届いた場合は中身を取り出す
const pdfjsLib = pdfjsModule.default || pdfjsModule;

// Workerのパス設定（確実な公式CDNバージョンを指定）
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ==========================================
// 2. 共通のUI制御関数
// ==========================================
let logoImg = null;

function uiStart(msg) {
    document.getElementById('status-panel').style.display = 'block';
    document.getElementById('status-text').innerText = msg;
    document.getElementById('dl-area').innerHTML = '';
    document.getElementById('mainBar').value = 0;
    document.getElementById('preview-section').style.display = 'none';
}

function uiDone(msg, html) {
    document.getElementById('status-text').innerText = msg;
    document.getElementById('dl-area').innerHTML = html;
    document.getElementById('mainBar').value = 100;
}

// ==========================================
// 3. 各機能のイベントリスナー
// ==========================================

// ロゴ画像の読み込み
document.getElementById('logoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.src = ev.target.result;
            img.onload = () => {
                logoImg = img;
                const preview = document.getElementById('logoPreview');
                preview.src = ev.target.result;
                preview.style.display = 'block';
            };
        };
        reader.readAsDataURL(file);
    }
});

// ① 画像変換エンジン
document.getElementById('toImage').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    uiStart("画像を生成中...");
    const zip = new JSZip();
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';

    try {
        const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.height = viewport.height; canvas.width = viewport.width;
            await page.render({ canvasContext: ctx, viewport }).promise;

            if (logoImg) {
                const lw = viewport.width * 0.15;
                const lh = (logoImg.height / logoImg.width) * lw;
                ctx.globalAlpha = 0.5;
                ctx.drawImage(logoImg, viewport.width - lw - 20, viewport.height - lh - 20, lw, lh);
            }

            const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
            const url = URL.createObjectURL(blob);
            const fileName = `image_page_${i}.png`;
            zip.file(fileName, blob);

            const div = document.createElement('div');
            div.className = 'img-card';
            div.innerHTML = `<img src="${url}"><br><a href="${url}" download="${fileName}" class="btn btn-sub btn-small">保存</a>`;
            gallery.appendChild(div);
            document.getElementById('mainBar').value = (i / pdf.numPages) * 100;
        }
        const zipContent = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
        const zipUrl = URL.createObjectURL(zipContent);
        uiDone("完了！", `<a href="${zipUrl}" download="pdf_images.zip" class="btn">まとめて保存 (ZIP)</a>`);
        document.getElementById('preview-section').style.display = 'block';
    } catch (err) { 
        console.error(err);
        alert("エラー: " + err.message); 
    }
});

// ② 高品質Word抽出エンジン
document.getElementById('toWord').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    uiStart("精密テキスト接着中...");
    try {
        const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
        const allDocChildren = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            const lines = {};
            textContent.items.forEach(item => {
                const y = Math.round(item.transform[5] / 5) * 5;
                if (!lines[y]) lines[y] = [];
                lines[y].push(item);
            });

            const sortedY = Object.keys(lines).sort((a, b) => b - a);
            
            let currentParaRuns = [];
            let lastY = null;

            for (let y of sortedY) {
                const rowText = lines[y].sort((a, b) => a.transform[4] - b.transform[4])
                                       .map(item => item.str).join('');
                
                if (rowText.trim().length === 0) continue;

                const currentY = parseFloat(y);
                if (lastY !== null && Math.abs(lastY - currentY) > 20) {
                    allDocChildren.push(new docx.Paragraph({
                        children: currentParaRuns,
                        spacing: { after: 120 }
                    }));
                    currentParaRuns = [];
                }
                
                currentParaRuns.push(new docx.TextRun({ text: rowText, font: "MS Mincho" }));
                lastY = currentY;
            }

            if (currentParaRuns.length > 0) {
                allDocChildren.push(new docx.Paragraph({
                    children: currentParaRuns,
                    spacing: { after: 120 }
                }));
            }

            if (i < pdf.numPages) {
                allDocChildren.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
            }
            document.getElementById('mainBar').value = (i / pdf.numPages) * 100;
        }

        const doc = new docx.Document({
            sections: [{ properties: {}, children: allDocChildren }]
        });

        const blob = await docx.Packer.toBlob(doc);
        uiDone("リベンジ完了！", `<a href="${URL.createObjectURL(blob)}" download="${file.name.replace('.pdf', '.docx')}" class="btn">Wordを保存</a>`);
    } catch (err) { 
        console.error(err);
        alert("変換エラー: " + err.message); 
    }
});

// ③ PDF結合
document.getElementById('toMerge').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files); if (files.length < 2) return;
    uiStart("PDFを結合中...");
    try {
        const merged = await PDFDocument.create();
        for (const f of files) {
            const doc = await PDFDocument.load(await f.arrayBuffer());
            const pages = await merged.copyPages(doc, doc.getPageIndices());
            pages.forEach(p => merged.addPage(p));
        }
        const blob = new Blob([await merged.save()], { type: 'application/pdf' });
        uiDone("結合完了！", `<a href="${URL.createObjectURL(blob)}" download="merged.pdf" class="btn">結合PDFを保存</a>`);
    } catch (err) { 
        console.error(err);
        alert(err.message); 
    }
});

// ④ 匿名化
document.getElementById('toClean').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    uiStart("メタデータ削除中...");
    try {
        const doc = await PDFDocument.load(await file.arrayBuffer());
        doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setCreator(''); doc.setProducer('');
        const blob = new Blob([await doc.save()], { type: 'application/pdf' });
        uiDone("完了！", `<a href="${URL.createObjectURL(blob)}" download="cleaned.pdf" class="btn">保存</a>`);
    } catch (err) { 
        console.error(err);
        alert(err.message); 
    }
});