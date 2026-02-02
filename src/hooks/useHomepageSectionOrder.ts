import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SectionId = "showclips" | "events" | "communities";

const DEFAULT_ORDER: SectionId[] = ["showclips", "events", "communities"];

export function useHomepageSectionOrder() {
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(DEFAULT_ORDER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSectionOrder();
  }, []);

  const fetchSectionOrder = async () => {
    try {
      const { data, error } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "homepage_section_order")
        .maybeSingle();

      if (error) throw error;

      if (data?.value && Array.isArray(data.value)) {
        setSectionOrder(data.value as SectionId[]);
      }
    } catch (error) {
      console.error("Error fetching section order:", error);
      // Keep default order on error
    } finally {
      setLoading(false);
    }
  };

  const updateSectionOrder = async (newOrder: SectionId[]) => {
    try {
      const { error } = await supabase
        .from("site_config")
        .update({ value: newOrder, updated_at: new Date().toISOString() })
        .eq("key", "homepage_section_order");

      if (error) throw error;

      setSectionOrder(newOrder);
      return true;
    } catch (error) {
      console.error("Error updating section order:", error);
      return false;
    }
  };

  return { sectionOrder, loading, updateSectionOrder, refetch: fetchSectionOrder };
}
