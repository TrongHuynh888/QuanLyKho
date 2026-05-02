import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeLabelProps {
  companyName?: string;
  productName: string;
  sku: string;
  contractNumber?: string;
  productionDate?: string;
  packagingSpec?: string;
  userName?: string;
  lotNumber: string;
}

export default function BarcodeLabel({
  companyName = "TKA",
  productName,
  sku,
  contractNumber,
  productionDate,
  packagingSpec,
  userName = "NV",
  lotNumber
}: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, lotNumber || "000000", {
          format: "CODE128",
          width: 1.8,
          height: 45,
          displayValue: true,
          fontSize: 14,
          fontOptions: "bold",
          margin: 0,
          background: "transparent"
        });
      } catch (err) {
        console.error("Barcode generated failed:", err);
      }
    }
  }, [lotNumber]);

  const removeVietnameseTones = (str: string) => {
    if (!str) return str;
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
  };

  const line1 = `${companyName}, ${sku}`;
  
  // Format date to MM-DD if possible or just use what we have
  let formattedDate = productionDate || "";
  if (formattedDate && formattedDate.includes("-")) {
     const parts = formattedDate.split("-");
     if (parts.length >= 3) {
        formattedDate = `${parts[1]}-${parts[2]}`; // MM-DD
     }
  }

  const line2 = [contractNumber, formattedDate ? `${formattedDate} DS` : "", removeVietnameseTones(packagingSpec || "")].filter(Boolean).join(" ");
  
  // Extract initials for the User Name
  const userInitials = userName.split(" ").map(w => w.charAt(0)).join("").toUpperCase().substring(0, 3) || "NV";
  const line3 = `${userInitials}, ${sku}`;

  return (
    <div className="barcode-label break-inside-avoid bg-white w-[75mm] min-h-[50mm] border border-neutral-300 p-3 pt-6 text-black flex flex-col font-mono text-[11px] leading-snug">
      <div className="flex-1 flex flex-col items-center justify-center -mt-2">
        <svg ref={svgRef}></svg>
      </div>
      <div className="w-full mt-3 font-bold space-y-0.5 tracking-tight uppercase text-left">
        <p>{line1}</p>
        <p>{line2}</p>
        <p>{line3}</p>
      </div>
    </div>
  );
}
