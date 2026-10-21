import { useState, useRef, useEffect } from 'react';
import { 
  FileUp, 
  Check, 
  AlertCircle, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Store, 
  MapPin,
  Clock,
  Plus,
  Sparkles,
  Layers,
  Sliders,
  Maximize2
} from 'lucide-react';
import { 
  calculateFileSubtotal, 
  calculateOrderPrice, 
  calculateFilePricingBreakdown,
  formatBytes, 
  MAXIN_SHOP,
  DEFAULT_PRICING 
} from '../data/mockData';
import { 
  PaperSize, 
  PaperType,
  PrintType, 
  Orientation, 
  DuplexMode, 
  PrintQuality,
  BindingOption, 
  PrintOrder,
  PricingSettings,
  ShopLocation 
} from '../types/print';
import { submitOrder, fetchSettings } from '../services/api';
import { OrderConfirmationReceipt } from '../components/OrderConfirmationReceipt';

interface OrderViewProps {
  onNavigate: (tab: string, param?: string) => void;
}

interface UploadDraftFile {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData?: string;
  previewUrl?: string;
  pageCount: number;
  copies: number;
  paperType: PaperType;        // 'ordinary' | 'glossy'
  paperSize: PaperSize;        // 'Letter' | 'A4' | 'Legal'
  photoPaperSize: string;      // '4x6' | '5x7' | 'A4'
  printType: PrintType;        // 'bw' | 'color'
  orientation: Orientation;    // 'portrait' | 'landscape'
  duplex: DuplexMode;          // 'single' | 'back_to_back'
  borderless: boolean;         // true = +₱5 surcharge
  quality: PrintQuality;       // 'standard' (₱0) | 'high' (+₱10)
}

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB total limit check
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'webp', 'txt'];

export function OrderView({ onNavigate }: OrderViewProps) {
  // Shop & Pricing
  const [language, setLanguage] = useState<'en' | 'fil'>('en');
  const isFilipino = language === 'fil';
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [shop, setShop] = useState<ShopLocation>(MAXIN_SHOP);

  // Customer Contact
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Multi-file state
  const [draftFiles, setDraftFiles] = useState<UploadDraftFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Finishing & Instructions
  const [binding, setBinding] = useState<BindingOption>('none');
  const [instructions, setInstructions] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<PrintOrder | null>(null);
  
  // Idempotency token ref (reused on submit retry)
  const clientRequestIdRef = useRef<string>(`req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings().then(res => {
      if (res.pricing) setPricing(res.pricing);
      if (res.shops && res.shops.length > 0) {
        setShop(res.shops[0]);
      }
    });
  }, []);

  // Calculate live order total in PHP
  const totalPrice = calculateOrderPrice({
    files: draftFiles.map(f => ({
      pages: f.pageCount,
      copies: f.copies,
      paperSize: f.paperSize,
      paperType: f.paperType,
      photoPaperSize: f.photoPaperSize,
      printType: f.printType,
      duplex: f.duplex,
      borderless: f.borderless,
      quality: f.quality,
    })),
    binding,
    pricing,
  });

  const handleAddFiles = (filesList: FileList | null) => {
    setFileError(null);
    if (!filesList || filesList.length === 0) return;

    const newDrafts: UploadDraftFile[] = [];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setFileError(`File "${file.name}" has an unsupported format. Please upload PDF, Word (DOCX/DOC), JPG, PNG, or TXT.`);
        continue;
      }

      if (file.size > MAX_TOTAL_SIZE) {
        setFileError(`File "${file.name}" is too large (${formatBytes(file.size)}). Max allowed size is 50 MB.`);
        continue;
      }

      let initialPages = 1;
      if (file.type.includes('pdf')) {
        initialPages = Math.max(1, Math.min(50, Math.round(file.size / 150000)));
      }

      const fileId = `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let previewUrl: string | undefined;

      const isImage = file.type.startsWith('image/');
      if (isImage) {
        previewUrl = URL.createObjectURL(file);
      }

      const draft: UploadDraftFile = {
        id: fileId,
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        previewUrl,
        pageCount: initialPages,
        copies: 1,
        // Default photos to glossy, and documents to ordinary
        paperType: isImage ? 'glossy' : 'ordinary',
        paperSize: 'A4',
        photoPaperSize: '4x6',
        printType: isImage ? 'color' : 'bw',
        orientation: 'portrait',
        duplex: 'single', // Single-Sided default (Back-to-Back is +₱5)
        borderless: false, // Borderless toggle is +₱5
        quality: 'standard', // Standard Quality default (High Quality is +₱10)
      };

      newDrafts.push(draft);
    }

    setDraftFiles(prev => [...prev, ...newDrafts]);
  };

  const handleUpdateFileOption = (fileId: string, key: keyof UploadDraftFile, value: any) => {
    setDraftFiles(prev =>
      prev.map(f => {
        if (f.id === fileId) {
          return { ...f, [key]: value };
        }
        return f;
      })
    );
  };

  const handleRemoveFile = (fileId: string) => {
    setDraftFiles(prev => {
      const target = prev.find(f => f.id === fileId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  /**
   * Resilient client-side optimizer:
   * Compresses oversized smartphone photos before sending to prevent Vercel's 4.5MB Serverless limit error.
   */
  const getOptimizedFileData = async (file: File): Promise<string> => {
    if (file.type.startsWith('image/')) {
      try {
        return await new Promise<string>((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            const maxDim = 1800;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.85));
              return;
            }
            const reader = new FileReader();
            reader.onload = ev => resolve(ev.target?.result as string);
            reader.readAsDataURL(file);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            const reader = new FileReader();
            reader.onload = ev => resolve(ev.target?.result as string);
            reader.readAsDataURL(file);
          };
          img.src = url;
        });
      } catch (_) {}
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isSubmitting) return;

    if (!customerName.trim()) {
      setFormError('Pakilagay ang buong pangalan mo para matukoy ng staff ang order mo.');
      return;
    }

    if (draftFiles.length === 0) {
      setFormError('Mag-upload muna ng kahit isang dokumento o larawan na ipi-print.');
      return;
    }

    if (!shop.acceptingOrders) {
      setFormError('Pansamantalang hindi tumatanggap ng bagong order ang Maxin Printing Service.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(15);

    const progressTimer = setInterval(() => {
      setUploadProgress(p => (p >= 85 ? p : p + 18));
    }, 200);

    try {
      const payloadFiles = await Promise.all(
        draftFiles.map(async df => {
          if (!df.fileData) {
            df.fileData = await getOptimizedFileData(df.file);
          }
          return {
            fileName: df.fileName,
            fileSize: df.fileSize,
            fileType: df.fileType,
            fileData: df.fileData,
            pageCount: df.pageCount,
            copies: df.copies,
            paperSize: df.paperSize,
            paperType: df.paperType,
            photoPaperSize: df.photoPaperSize,
            printType: df.printType,
            orientation: df.orientation,
            duplex: df.duplex,
            borderless: df.borderless,
            quality: df.quality,
          };
        })
      );

      const orderPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        shopId: 'maxin-printing-service',
        clientRequestId: clientRequestIdRef.current,
        binding,
        instructions: instructions.trim() || undefined,
        files: payloadFiles,
      };

      // Vercel serverless request bodies are limited to about 4.5 MB.
      // Check the fully encoded JSON payload first so customers receive a clear
      // recovery instruction instead of a generic 413/server error.
      const payloadBytes = new Blob([JSON.stringify(orderPayload)]).size;
      const maxRequestBytes = 4 * 1024 * 1024;
      if (payloadBytes > maxRequestBytes) {
        throw new Error(
          isFilipino ? 'Masyadong malaki ang pinagsamang files (dapat mas mababa sa 4 MB). Bawasan ang laki ng PDF/larawan o mag-order gamit ang mas kaunting files.' : 'These files are too large to send together (the upload request must be under 4 MB). Please reduce the PDF/photo file sizes or submit fewer/smaller files in a new order.'
        );
      }

      setUploadProgress(90);
      const res = await submitOrder(orderPayload);

      clearInterval(progressTimer);
      setUploadProgress(100);
      setIsSubmitting(false);

      if (res.order) {
        setCompletedOrder(res.order);
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsSubmitting(false);
      setFormError(isFilipino ? (String(err.message || '').toLowerCase().match(/offline|internet|server|fetch|network/) ? 'Hindi ma-send ang file. Baka mahina o walang internet connection. Subukang lumipat sa mas malakas na signal at i-send ulit. Nandito pa rin ang mga napili mong file.' : (err.message || 'Nagkaroon ng error sa pag-send ng order. Pakisubukan ulit.')) : (err.message || 'Error communicating with print server. Please check your network and try again.'));
    }
  };

  // If order was submitted, display the Receipt-Style Confirmation directly!
  if (completedOrder) {
    return (
      <OrderConfirmationReceipt
        order={completedOrder}
        trackingToken={completedOrder.trackingToken}
        onNavigateHome={() => {
          setCompletedOrder(null);
          setDraftFiles([]);
          setCustomerName('');
          onNavigate('landing');
        }}
        onOrderUpdated={updated => setCompletedOrder(updated)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pd-fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eef4f1] text-[#23664B] text-xs font-semibold mb-2">
          <Store className="w-3.5 h-3.5" />
          <span>{isFilipino ? 'Maxin Printing Service — Direktang Order' : 'Maxin Printing Service — Direct Order'}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl sm:text-3xl font-extrabold text-[#20352A]">
          {isFilipino ? 'Mag-order ng Printing' : 'Place Your Print Order'}
        </h1><div className="inline-flex rounded-xl border border-[#D4DDD5] bg-white p-1" aria-label="Language"><button type="button" onClick={() => setLanguage('en')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${!isFilipino ? 'bg-[#23664B] text-white' : 'text-[#20352A]'}`}>English</button><button type="button" onClick={() => setLanguage('fil')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${isFilipino ? 'bg-[#23664B] text-white' : 'text-[#20352A]'}`}>Filipino</button></div></div>
        <p className="text-xs sm:text-sm text-[#5A6E64] mt-1">
          {isFilipino ? 'Mag-upload ng dokumento o larawan, piliin ang printing options, at kunin ang order sa counter.' : 'Upload documents or photos, configure printing specifications, and pick up at the express counter.'}
        </p>

        {/* Shop Intake Info Bar */}
        <div className="mt-4 p-3 rounded-xl bg-white border border-[#D4DDD5] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#20352A]">
            <MapPin className="w-4 h-4 text-[#23664B] shrink-0" />
            <span className="font-semibold">{shop.name}</span>
            <span className="text-[#5A6E64] hidden sm:inline">• {shop.counterInfo}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-[#5A6E64]">
              <Clock className="w-3.5 h-3.5" />
              <span>Est. Wait: ~{shop.avgWaitMins} mins</span>
            </span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
              shop.acceptingOrders ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {shop.acceptingOrders ? 'Queue Open' : 'Intake Paused'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Customer Contact */}
        <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E7E2] pb-3">
            <h2 className="text-base font-bold text-[#20352A] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#23664B] text-white text-xs flex items-center justify-center font-bold">1</span>
              {isFilipino ? 'Impormasyon ng Customer' : 'Customer Information'}
            </h2>
            <span className="text-xs text-[#5A6E64]">No account registration required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-semibold text-[#20352A]">
                {isFilipino ? 'Buong Pangalan' : 'Full Name'} <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder={isFilipino ? 'Hal. Juan Dela Cruz' : 'e.g. Juan Dela Cruz'}
                className="w-full text-xs sm:text-sm py-2.5 px-3 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] placeholder:text-[#5A6E64]/60 focus:outline-hidden focus:border-[#23664B]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-semibold text-[#20352A]">{isFilipino ? 'Mobile Number (Opsyonal)' : 'Mobile Number (Optional)'}</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="e.g. 0917 123 4567"
                className="w-full text-xs sm:text-sm py-2.5 px-3 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] placeholder:text-[#5A6E64]/60 focus:outline-hidden focus:border-[#23664B]"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-semibold text-[#20352A]">{isFilipino ? 'Email (Opsyonal)' : 'Email (Optional)'}</label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="e.g. juan@example.com"
                className="w-full text-xs sm:text-sm py-2.5 px-3 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] placeholder:text-[#5A6E64]/60 focus:outline-hidden focus:border-[#23664B]"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Multi-File Upload & Specifications */}
        <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#E2E7E2] pb-3">
            <h2 className="text-base font-bold text-[#20352A] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#23664B] text-white text-xs flex items-center justify-center font-bold">2</span>
              Upload Documents & Customize Print Settings
            </h2>
            <span className="text-xs text-[#5A6E64]">PDF, Word, JPG, PNG up to 50 MB</span>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              handleAddFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#D4DDD5] hover:border-[#23664B] rounded-2xl p-6 text-center cursor-pointer bg-[#F7F8F5] pd-interactive transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.txt"
              onChange={e => handleAddFiles(e.target.files)}
            />

            <div className="space-y-2 py-2">
              <div className="w-12 h-12 rounded-full bg-white border border-[#D4DDD5] shadow-xs flex items-center justify-center mx-auto text-[#23664B]">
                <FileUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#20352A]">
                  Click to browse or drop multiple files here
                </p>
                <p className="text-xs text-[#5A6E64] mt-0.5">
                  Supports ordinary paper documents & Glossy Photo Paper attachments.
                </p>
              </div>
            </div>
          </div>

          {fileError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Uploaded Documents List with Individual Specifications */}
          {draftFiles.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#23664B]">
                  Uploaded Documents ({draftFiles.length})
                </h3>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#23664B] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another File</span>
                </button>
              </div>

              <div className="space-y-4">
                {draftFiles.map((df, index) => {
                  const breakdown = calculateFilePricingBreakdown({
                    pages: df.pageCount,
                    copies: df.copies,
                    paperSize: df.paperSize,
                    paperType: df.paperType,
                    photoPaperSize: df.photoPaperSize,
                    printType: df.printType,
                    duplex: df.duplex,
                    borderless: df.borderless,
                    quality: df.quality,
                    pricing,
                  });

                  const isGlossy = df.paperType === 'glossy';

                  return (
                    <div
                      key={df.id}
                      className="p-4 sm:p-5 rounded-2xl border border-[#D4DDD5] bg-[#F7F8F5]/70 hover:bg-white transition-all space-y-4 shadow-2xs"
                    >
                      {/* Document Top Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-white border border-[#D4DDD5] flex items-center justify-center text-[#23664B] shrink-0 overflow-hidden shadow-2xs">
                            {df.previewUrl ? (
                              <img src={df.previewUrl} alt={df.fileName} className="w-full h-full object-cover" />
                            ) : (
                              <FileText className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs sm:text-sm text-[#20352A] max-w-xs sm:max-w-md truncate">
                                {index + 1}. {df.fileName}
                              </h4>
                              {isGlossy && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  Glossy Photo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#5A6E64] mt-0.5">
                              {formatBytes(df.fileSize)} • Base: ₱{breakdown.baseCost.toFixed(2)}
                              {breakdown.totalSurcharges > 0 && (
                                <span className="text-[#23664B] font-medium"> + Surcharges: ₱{breakdown.totalSurcharges.toFixed(2)}</span>
                              )}
                              {' '}• Subtotal: <span className="font-extrabold text-[#23664B]">₱{breakdown.subtotal.toFixed(2)}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFile(df.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Primary Controls Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-3 border-t border-[#E2E7E2] text-xs">
                        {/* Paper Type (Section 4) */}
                        <div className="space-y-1 col-span-2 sm:col-span-2 lg:col-span-2">
                          <label className="text-[11px] font-semibold text-[#5A6E64] flex items-center gap-1">
                            <span>Paper Type</span>
                            {isGlossy && <Sparkles className="w-3 h-3 text-amber-600" />}
                          </label>
                          <select
                            value={df.paperType}
                            onChange={e => {
                              const newType = e.target.value as PaperType;
                              handleUpdateFileOption(df.id, 'paperType', newType);
                              if (newType === 'glossy') {
                                handleUpdateFileOption(df.id, 'duplex', 'single'); // Photo paper defaults single-sided
                              }
                            }}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] font-semibold"
                          >
                            <option value="ordinary">📄 Ordinary Paper (Letter, A4, Legal)</option>
                            <option value="glossy">🖼️ Photo Paper — Glossy (₱25 B&W / ₱35 Color)</option>
                          </select>
                        </div>

                        {/* Dimensions / Size (Section 4) */}
                        <div className="space-y-1 col-span-1 sm:col-span-1 lg:col-span-1">
                          <label className="text-[11px] font-semibold text-[#5A6E64]">
                            {isGlossy ? 'Photo Size' : 'Paper Size'}
                          </label>
                          {isGlossy ? (
                            <select
                              value={df.photoPaperSize}
                              onChange={e => handleUpdateFileOption(df.id, 'photoPaperSize', e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] font-medium"
                            >
                              <option value="4x6">4 × 6 in (4R)</option>
                              <option value="5x7">5 × 7 in (5R)</option>
                              <option value="A4">A4 Photo</option>
                            </select>
                          ) : (
                            <select
                              value={df.paperSize}
                              onChange={e => handleUpdateFileOption(df.id, 'paperSize', e.target.value as PaperSize)}
                              className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] font-medium"
                            >
                              <option value="Letter">Letter / Short (₱3/₱6)</option>
                              <option value="A4">A4 Standard (₱5/₱8)</option>
                              <option value="Legal">Legal / Long (₱7/₱10)</option>
                                            </select>
                          )}
                        </div>

                        {/* Color Mode */}
                        <div className="space-y-1 col-span-1 sm:col-span-1 lg:col-span-1">
                          <label className="text-[11px] font-semibold text-[#5A6E64]">Color Mode</label>
                          <select
                            value={df.printType}
                            onChange={e => handleUpdateFileOption(df.id, 'printType', e.target.value as PrintType)}
                            className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] font-medium"
                          >
                            <option value="bw">Black & White</option>
                            <option value="color">Full Color</option>
                          </select>
                        </div>

                        {/* Pages & Copies */}
                        <div className="space-y-1 col-span-1 sm:col-span-1 lg:col-span-1">
                          <label className="text-[11px] font-semibold text-[#5A6E64]">
                            {isGlossy ? 'Sheets / Photos' : 'Pages'}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={df.pageCount}
                            onChange={e => handleUpdateFileOption(df.id, 'pageCount', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-center font-bold text-[#20352A]"
                          />
                        </div>

                        <div className="space-y-1 col-span-1 sm:col-span-1 lg:col-span-1">
                          <label className="text-[11px] font-semibold text-[#5A6E64]">Copies</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={df.copies}
                            onChange={e => handleUpdateFileOption(df.id, 'copies', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-center font-bold text-[#20352A]"
                          />
                        </div>
                      </div>

                      {/* Secondary Options Grid: Back-to-Back, Borderless, Quality (Sections 2, 3, 5) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                        {/* Sides (Section 2: Replace Double-Sided with Back-to-Back) */}
                        <div className="space-y-1 p-2.5 rounded-xl bg-white border border-[#D4DDD5]/80">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-[#20352A]">
                              Sides (Duplex)
                            </label>
                            <span className="text-[10px] text-[#5A6E64]">
                              {isGlossy ? 'Single-Sided' : (df.duplex === 'single' ? 'Free (₱0)' : '+₱5.00 surcharge')}
                            </span>
                          </div>
                          {isGlossy ? (
                            <div className="py-1.5 px-2.5 rounded-lg bg-gray-100 border border-[#D4DDD5] text-[#5A6E64] font-medium text-xs">
                              Single-Sided (Glossy photo paper)
                            </div>
                          ) : (
                            <select
                              value={df.duplex}
                              onChange={e => handleUpdateFileOption(df.id, 'duplex', e.target.value as DuplexMode)}
                              className="w-full py-1.5 px-2 rounded-lg bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] font-medium"
                            >
                              <option value="single">Single-Sided — ₱0</option>
                              <option value="back_to_back">Back-to-Back — +₱5 per job</option>
                            </select>
                          )}
                          <p className="text-[10px] text-[#5A6E64] mt-0.5">
                            {isGlossy ? 'Duplex not supported on photo sheets' : 'Duplex prints on both sides (+₱5 flat per file)'}
                          </p>
                        </div>

                        {/* Borderless Printing Toggle (Section 3) */}
                        <div className="space-y-1 p-2.5 rounded-xl bg-white border border-[#D4DDD5]/80">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-[#20352A] flex items-center gap-1">
                              <Maximize2 className="w-3 h-3 text-[#23664B]" />
                              <span>Borderless Printing</span>
                            </label>
                            <span className="text-[10px] text-[#5A6E64]">
                              {df.borderless ? '+₱5.00 surcharge' : 'Standard margins (₱0)'}
                            </span>
                          </div>
                          <label className="flex items-center gap-2 pt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={df.borderless}
                              onChange={e => handleUpdateFileOption(df.id, 'borderless', e.target.checked)}
                              className="w-4 h-4 rounded text-[#23664B] focus:ring-[#23664B] accent-[#23664B]"
                            />
                            <span className="text-[11px] text-[#20352A] font-medium">
                              Enable edge-to-edge printing (+₱5)
                            </span>
                          </label>
                          <p className="text-[10px] text-[#5A6E64] mt-0.5">
                            Eliminates paper margins; ideal for full-bleed photos & posters
                          </p>
                        </div>

                        {/* Printing Quality (Section 5) */}
                        <div className="space-y-1 p-2.5 rounded-xl bg-white border border-[#D4DDD5]/80">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-[#20352A] flex items-center gap-1">
                              <Sliders className="w-3 h-3 text-[#23664B]" />
                              <span>Printing Quality</span>
                            </label>
                            <span className="text-[10px] text-[#5A6E64]">
                              {df.quality === 'high' ? '+₱10.00 surcharge' : 'Standard (₱0)'}
                            </span>
                          </div>
                          <select
                            value={df.quality}
                            onChange={e => handleUpdateFileOption(df.id, 'quality', e.target.value as PrintQuality)}
                            className="w-full py-1.5 px-2 rounded-lg bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] font-medium"
                          >
                            <option value="standard">Standard Quality — ₱0</option>
                            <option value="high">High Quality — +₱10 per job</option>
                          </select>
                          <p className="text-[10px] text-[#5A6E64] mt-0.5">
                            High Quality delivers richer colors and finer resolution
                          </p>
                        </div>
                      </div>

                      {/* Surcharges & Subtotal Summary Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#D4DDD5] text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5 text-[#5A6E64]">
                          <span>Charges applied:</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-[#F7F8F5] border border-[#E2E7E2] text-[#20352A] font-medium">
                            Base: ₱{breakdown.baseCost.toFixed(2)}
                          </span>
                          {breakdown.surcharges.backToBack > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                              Back-to-Back +₱5
                            </span>
                          )}
                          {breakdown.surcharges.borderless > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                              Borderless +₱5
                            </span>
                          )}
                          {breakdown.surcharges.quality > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                              High Quality +₱10
                            </span>
                          )}
                          {breakdown.totalSurcharges === 0 && (
                            <span className="text-[#5A6E64]">No extra surcharges</span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[#5A6E64] mr-1.5">File Total:</span>
                          <span className="font-extrabold text-[#23664B] text-sm">
                            ₱{breakdown.subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Finishing & Instructions */}
        <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E7E2] pb-3">
            <h2 className="text-base font-bold text-[#20352A] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#23664B] text-white text-xs flex items-center justify-center font-bold">3</span>
              Finishing & Instructions
            </h2>
            <span className="text-xs text-[#5A6E64]">Optional counter options</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#20352A]">Document Binding</label>
              <select
                value={binding}
                onChange={e => setBinding(e.target.value as BindingOption)}
                className="w-full text-xs sm:text-sm py-2.5 px-3 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A]"
              >
                <option value="none">No Binding (Loose Sheets — ₱0)</option>
                <option value="staple">Corner Staple (+₱5.00)</option>
                <option value="spiral">Spiral Ring Binding (+₱35.00)</option>
                <option value="booklet">Folded Booklet (+₱45.00)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#20352A]">Special Instructions for Staff</label>
              <input
                type="text"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="e.g. print pages 1-5 only, cardstock cover"
                className="w-full text-xs sm:text-sm py-2.5 px-3 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] placeholder:text-[#5A6E64]/60"
              />
            </div>
          </div>
        </div>

        {/* Total & Submit Box */}
        <div className="bg-white rounded-2xl p-6 border-2 border-[#23664B]/30 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[#23664B] uppercase tracking-wider">
                Total Order Amount
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-black text-[#20352A]">
                  ₱{totalPrice.toFixed(2)}
                </span>
                <span className="text-xs text-[#5A6E64]">
                  (Pay at counter upon pickup)
                </span>
              </div>
              <p className="text-xs text-[#5A6E64] mt-1">
                {draftFiles.length} {draftFiles.length === 1 ? 'file' : 'files'} • {binding !== 'none' ? binding : 'No binding'} • Maxin Printing Service
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || draftFiles.length === 0}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isSubmitting || draftFiles.length === 0
                  ? 'bg-[#5A6E64] opacity-70 cursor-not-allowed'
                  : 'bg-[#23664B] hover:bg-[#1b523c]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting {uploadProgress}%...</span>
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4" />
                  <span>Submit Print Request</span>
                </>
              )}
            </button>
          </div>

          {isSubmitting && (
            <div className="space-y-1.5 pt-2">
              <div className="w-full h-2 bg-[#eef4f1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#23664B] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-[#5A6E64] text-center">
                Generating queue ticket and recording order in Maxin Printing Service...
              </p>
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Submission Notice</p>
                <p>{formError}</p>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
