import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generatePdf(pageEls: HTMLElement[], filename: string): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1056, 816], hotfixes: ['px_scaling'] });
  for (let i = 0; i < pageEls.length; i++) {
    const canvas = await html2canvas(pageEls[i], {
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 1056,
      height: 816,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) pdf.addPage([1056, 816], 'landscape');
    pdf.addImage(imgData, 'JPEG', 0, 0, 1056, 816);
  }
  pdf.save(filename);
}
