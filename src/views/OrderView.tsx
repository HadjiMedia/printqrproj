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
  Plus
} from 'lucide-react';
import { calculateFileSubtotal, calculateOrderPrice, formatBytes, MAXIN_SHOP } from '../data/mockData';
import { 
  PaperSize, 
  PrintType, 
  Orientation, 
  DuplexMode, 
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
  paperSize: PaperSize;
  printType: PrintType;
  orientation: Orientation;
  duplex: DuplexMode;
}

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB total
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'webp', 'txt'];

export function OrderView({ onNavigate }: OrderViewProps) {
  // Shop & Pricing
  const [pricing, setPricing] = useState<PricingSettings | undefined>(undefined);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings().then(res => {
      setPricing(res.pricing);
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
      printType: f.printType,
      duplex: f.duplex,
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

      if (file.type.startsWith('image/')) {
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
        paperSize: 'A4',
        printType: 'bw',
        orientation: 'portrait',
        duplex: 'single',
      };

      const reader = new FileReader();
      reader.onload = e => {
        draft.fileData = e.target?.result as string;
      };
      reader.readAsDataURL(file);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) {
      setFormError('Please enter your full name so staff can label your print job.');
      return;
    }

    if (draftFiles.length === 0) {
      setFormError('Please upload at least one document or photo to print.');
      return;
    }

    if (!shop.acceptingOrders) {
      setFormError('Maxin Printing Service is currently paused and not accepting new orders.');
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
            df.fileData = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = ev => resolve(ev.target?.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(df.file);
            });
          }
          return {
            fileName: df.fileName,
            fileSize: df.fileSize,
            fileType: df.fileType,
            fileData: df.fileData,
            pageCount: df.pageCount,
            copies: df.copies,
            paperSize: df.paperSize,
            printType: df.printType,
            orientation: df.orientation,
            duplex: df.duplex,
          };
        })
      );

      setUploadProgress(90);

      const res = await submitOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        shopId: 'maxin-printing-service',
        binding,
        instructions: instructions.trim() || undefined,
        files: payloadFiles,
      });

      clearInterval(progressTimer);
      setUploadProgress(100);
      setIsSubmitting(false);

      if (res.order) {
        setCompletedOrder(res.order);
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsSubmitting(false);
      setFormError(err.message || 'Error communicating with print server. Please check your network and try again.');
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eef4f1] text-[#23664B] text-xs font-semibold mb-2">
          <Store className="w-3.5 h-3.5" />
          <span>Maxin Printing Service — Direct Order</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20352A]">
          Place a Print Order
        </h1>
        <p className="text-sm text-[#5A6E64] mt-1">
          Upload your documents, customize settings for each file, and receive your receipt and live queue ticket.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Customer Info & Maxin Shop Information */}
        <div className="bg-white rounded-2xl p-6 border border-[#D4DDD5] shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#E2E7E2] pb-3">
            <h2 className="text-base font-bold text-[#20352A] flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#23664B] text-white text-xs flex items-center justify-center font-bold">1</span>
              Customer Information
            </h2>
            <span className="text-xs text-[#5A6E64]">No account needed</span>
          </div>

          {/* Shop Header Pill */}
          <div className="p-3.5 rounded-xl bg-[#F7F8F5] border border-[#E2E7E2] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#23664B] text-white flex items-center justify-center font-bold shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-[#20352A]">{MAXIN_SHOP.name}</p>
                <p className="text-[#5A6E64]">{MAXIN_SHOP.address} — {MAXIN_SHOP.counterInfo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
              <Clock className="w-3.5 h-3.5 text-[#23664B]" />
              <span>Avg wait time: ~{MAXIN_SHOP.avgWaitMins} mins</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#20352A] flex items-center gap-1">
                <span>Your Name</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="w-full text-sm py-2.5 px-3.5 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] placeholder:text-[#5A6E64]/60 focus:outline-none focus:ring-2 focus:ring-[#23664B]/30"
              />
            </div>

            {/* Customer Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#20352A] flex items-center justify-between">
                <span>Mobile Number / GCash (Optional)</span>
                <span className="text-[#5A6E64] font-normal text-[11px]">For counter claim alerts</span>
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="e.g. +63 917 123 4567"
                className="w-full text-sm py-2.5 px-3.5 rounded-xl bg-[#F7F8F5] border border-[#D4DDD5] text-[#20352A] placeholder:text-[#5A6E64]/60 focus:outline-none focus:ring-2 focus:ring-[#23664B]/30"
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
            <span className="text-xs text-[#5A6E64]">PDF, DOCX, JPG, PNG up to 50 MB</span>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              handleAddFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#D4DDD5] hover:border-[#23664B] rounded-2xl p-6 text-center cursor-pointer bg-[#F7F8F5] transition-colors"
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
                  Upload PDF, Word, spreadsheets, resumes, and photo attachments.
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
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#23664B] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another File</span>
                </button>
              </div>

              <div className="space-y-3">
                {draftFiles.map((df, index) => {
                  const subtotal = calculateFileSubtotal({
                    pages: df.pageCount,
                    copies: df.copies,
                    paperSize: df.paperSize,
                    printType: df.printType,
                    duplex: df.duplex,
                    pricing,
                  });

                  return (
                    <div
                      key={df.id}
                      className="p-4 rounded-xl border border-[#D4DDD5] bg-[#F7F8F5]/60 hover:bg-white transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white border border-[#D4DDD5] flex items-center justify-center text-[#23664B] shrink-0 overflow-hidden shadow-2xs">
                            {df.previewUrl ? (
                              <img src={df.previewUrl} alt={df.fileName} className="w-full h-full object-cover" />
                            ) : (
                              <FileText className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs sm:text-sm text-[#20352A] max-w-xs sm:max-w-md truncate">
                              {index + 1}. {df.fileName}
                            </h4>
                            <p className="text-[11px] text-[#5A6E64]">
                              {formatBytes(df.fileSize)} • Subtotal: <span className="font-bold text-[#23664B]">₱{subtotal.toFixed(2)}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFile(df.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Individual Print Controls */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-[#E2E7E2] text-xs">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#5A6E64]">Pages</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={df.pageCount}
                            onChange={e => handleUpdateFileOption(df.id, 'pageCount', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-center font-bold text-[#20352A]"
                          />
                        </div>

                        <div className="space-y-1">
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

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#5A6E64]">Paper Size</label>
                          <select
                            value={df.paperSize}
                            onChange={e => handleUpdateFileOption(df.id, 'paperSize', e.target.value as PaperSize)}
                            className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] font-medium"
                          >
                            <option value="Letter">Short / Letter</option>
                            <option value="A4">A4 (Standard)</option>
                            <option value="Legal">Long / Legal</option>
                            <option value="A3">A3 (Large)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
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

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#5A6E64]">Sides</label>
                          <select
                            value={df.duplex}
                            onChange={e => handleUpdateFileOption(df.id, 'duplex', e.target.value as DuplexMode)}
                            className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] font-medium"
                          >
                            <option value="single">Single-Sided</option>
                            <option value="double_long">Double-Sided</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#5A6E64]">Orientation</label>
                          <select
                            value={df.orientation}
                            onChange={e => handleUpdateFileOption(df.id, 'orientation', e.target.value as Orientation)}
                            className="w-full py-1.5 px-2 rounded-lg bg-white border border-[#D4DDD5] text-[#20352A] font-medium"
                          >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                          </select>
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
                Generating queue ticket and sending files to Maxin Printing Service...
              </p>
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
