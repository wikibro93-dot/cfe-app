"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Camera, Plus, X, MapPin, ArrowLeft } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadImage } from "@/lib/upload";

const CATEGORIES = [
  { value: "MAIN_COURSE", label: "Main Course", emoji: "🍛" },
  { value: "APPETIZER", label: "Appetizer", emoji: "🥗" },
  { value: "DESSERT", label: "Dessert", emoji: "🍰" },
  { value: "BREAKFAST", label: "Breakfast", emoji: "🍳" },
  { value: "SNACK", label: "Snack", emoji: "🍿" },
  { value: "BEVERAGE", label: "Beverage", emoji: "☕" },
  { value: "BAKED_GOODS", label: "Baked Goods", emoji: "🥐" },
  { value: "SOUP", label: "Soup", emoji: "🍲" },
  { value: "SALAD", label: "Salad", emoji: "🥙" },
  { value: "OTHER", label: "Other", emoji: "🍽️" },
];

export default function EditDishPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userLocation, user } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "MAIN_COURSE",
    servings: "2",
    priceCredits: "5",
    pickupFrom: "",
    pickupTo: "",
    isSwappable: true,
    isFree: false,
    ingredients: [] as string[],
  });
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ingredientInput, setIngredientInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch existing dish data
  const { data: dish, isLoading, error } = useQuery({
    queryKey: ["dish", id],
    queryFn: async () => {
      // Auth is the httpOnly cookie — no token header is sent.
      const res = await fetch(`/api/dishes/${id}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Dish not found");
      return res.json();
    },
  });

  // Populate form when dish data is loaded
  useEffect(() => {
    if (dish) {
      // Check if user owns this dish
      if (user?.id !== dish.cookId) {
        toast.error("You can only edit your own dishes");
        router.push(`/dish/${id}`);
        return;
      }

      setForm({
        title: dish.title || "",
        description: dish.description || "",
        category: dish.category || "MAIN_COURSE",
        servings: dish.servings?.toString() || "2",
        priceCredits: dish.priceCredits?.toString() || "5",
        pickupFrom: dish.pickupFrom ? new Date(dish.pickupFrom).toISOString().slice(0, 16) : "",
        pickupTo: dish.pickupTo ? new Date(dish.pickupTo).toISOString().slice(0, 16) : "",
        isSwappable: dish.isSwappable ?? true,
        isFree: dish.isFree ?? false,
        ingredients: dish.ingredients || [],
      });
      setImage(dish.image || null);
      setLocation(dish.latitude && dish.longitude ? { lat: dish.latitude, lng: dish.longitude } : userLocation);
    }
  }, [dish, user, id, router, userLocation]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addIngredient = () => {
    const val = ingredientInput.trim();
    if (val && !form.ingredients.includes(val)) {
      setForm((f) => ({ ...f, ingredients: [...f.ingredients, val] }));
      setIngredientInput("");
    }
  };

  const removeIngredient = (i: number) => {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }));
  };

  const getLocation = () => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGettingLocation(false);
        toast.success("Location captured!");
      },
      () => {
        setGettingLocation(false);
        toast.error("Could not get location");
      }
    );
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return toast.error("Add a dish title");
    if (!form.pickupFrom || !form.pickupTo) return toast.error("Set pickup time");

    setLoading(true);
    try {
      let imageUrl = image;
      if (imageFile) {
        // Shared, validated upload (type/size checked, Cloudinary URL verified).
        try {
          imageUrl = await uploadImage(imageFile);
        } catch (err: any) {
          toast.error(err.message || "Image upload failed");
          return;
        }
      }

      const res = await fetch(`/api/dishes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...form,
          image: imageUrl,
          latitude: location?.lat,
          longitude: location?.lng,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Dish updated! 🎉");
      queryClient.invalidateQueries({ queryKey: ["dish", id] });
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      router.push(`/dish/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update dish");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Cancel this dish? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dishes/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Dish cancelled");
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      router.push("/feed");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel dish");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-float text-4xl">🍽️</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-500">Failed to load dish</p>
          <Button className="mt-4" onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const selectedCat = CATEGORIES.find((c) => c.value === form.category);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* Header with back button */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-stone-700 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-semibold">Back</span>
          </button>
          <h1 className="font-bold text-lg">Edit Dish</h1>
          <div className="w-20" /> {/* Spacer for center alignment */}
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Image */}
        <div
          onClick={() => fileRef.current?.click()}
          className="relative h-48 bg-linear-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-dashed border-green-300 flex items-center justify-center cursor-pointer overflow-hidden hover:border-green-500 transition-colors"
        >
          {image ? (
            <img src={image} alt="dish" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <div className="text-center">
              <Camera size={32} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-600">Add a photo</p>
              <p className="text-xs text-stone-400 mt-1">Tap to upload</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>

        {/* Title */}
        <Input
          label="Dish Name *"
          placeholder="e.g. Mum&apos;s Biryani, Homemade Pasta..."
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />

        {/* Description */}
        <Textarea
          label="Description"
          placeholder="Tell people about your dish..."
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
        />

        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-2">Category</label>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setForm((f) => ({ ...f, category: cat.value }))}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                  form.category === cat.value
                    ? "border-green-500 bg-green-50"
                    : "border-stone-200 bg-white"
                }`}
              >
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-[10px] font-semibold text-stone-600 leading-tight text-center">
                  {cat.label.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Servings + Price */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Servings *"
            type="number"
            min="1"
            placeholder="2"
            value={form.servings}
            onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))}
          />
          <Input
            label="Credits"
            type="number"
            min="0"
            placeholder="5"
            value={form.priceCredits}
            onChange={(e) => setForm((f) => ({ ...f, priceCredits: e.target.value }))}
            disabled={form.isFree}
          />
        </div>

        {/* Pickup time */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Pickup From *"
            type="datetime-local"
            value={form.pickupFrom}
            onChange={(e) => setForm((f) => ({ ...f, pickupFrom: e.target.value }))}
          />
          <Input
            label="Pickup Until *"
            type="datetime-local"
            value={form.pickupTo}
            onChange={(e) => setForm((f) => ({ ...f, pickupTo: e.target.value }))}
          />
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-2">Ingredients</label>
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="Add ingredient"
              value={ingredientInput}
              onChange={(e) => setIngredientInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addIngredient()}
            />
            <Button variant="outline" onClick={addIngredient} size="md">
              <Plus size={16} />
            </Button>
          </div>
          {form.ingredients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.ingredients.map((ing, i) => (
                <span key={i} className="flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                  {ing}
                  <button onClick={() => removeIngredient(i)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="bg-white rounded-2xl border border-stone-100 divide-y divide-stone-100">
          {[
            { key: "isSwappable", label: "Allow dish swaps", emoji: "🔄", desc: "Others can offer a swap" },
            { key: "isFree", label: "Offer for free", emoji: "💚", desc: "No credits needed" },
          ].map(({ key, label, emoji, desc }) => (
            <div key={key} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-bold text-stone-800">{emoji} {label}</p>
                <p className="text-xs text-stone-400">{desc}</p>
              </div>
              <button
                onClick={() => setForm((f) => ({ ...f, [key]: !f[key as keyof typeof form] }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  form[key as keyof typeof form] ? "bg-green-500" : "bg-stone-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    form[key as keyof typeof form] ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-stone-800">📍 Pickup Location</p>
              <p className="text-xs text-stone-400">
                {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Not set"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={getLocation} loading={gettingLocation}>
              <MapPin size={14} />
              {location ? "Update" : "Set Location"}
            </Button>
          </div>
        </div>

        {/* Submit */}
        <Button fullWidth size="lg" onClick={handleSubmit} loading={loading}>
          💾 Save Changes
        </Button>

        {/* Cancel dish — DELETE /api/dishes/[id] previously had no UI calling it */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-colors disabled:opacity-40"
        >
          {deleting ? "Cancelling…" : "🗑️ Cancel Dish"}
        </button>
      </div>
    </div>
  );
}
