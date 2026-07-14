export function openAipSearchVariants(search: string) {
  const variants = [
    search,
    search.normalize("NFD").replace(/\p{Diacritic}/gu, ""),
    search.replace(/ä/gi, (value) => value === "Ä" ? "Ae" : "ae")
      .replace(/ö/gi, (value) => value === "Ö" ? "Oe" : "oe")
      .replace(/ü/gi, (value) => value === "Ü" ? "Ue" : "ue")
      .replace(/ß/g, "ss"),
  ];
  return [...new Set(variants.map((value) => value.trim()).filter(Boolean))];
}
