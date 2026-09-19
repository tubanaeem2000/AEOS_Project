"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import RequireAuth from "@/components/RequireAuth";
import { useAuth } from "@/lib/AuthContext";
import { updateProfile, changePassword, uploadAvatar, removeAvatar, AuthError } from "@/lib/auth";

const MAX_AVATAR_BYTES = 500 * 1024; // matches the backend's ~500KB guidance

function ProfilePageContent() {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [department, setDepartment] = useState(user?.department || "");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || "");
    setDepartment(user.department || "");
  }, [user]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({ name, email, phone, department });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setProfileError(err instanceof AuthError ? err.message : "Couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || "");
    setDepartment(user.department || "");
    setProfileError("");
  };

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image is too large. Please use a photo under 500KB.");
      return;
    }

    setAvatarUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Couldn't read that file."));
        reader.readAsDataURL(file);
      });
      await uploadAvatar(dataUrl);
      await refreshUser();
    } catch (err) {
      setAvatarError(err instanceof AuthError || err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setAvatarError("");
    setAvatarUploading(true);
    try {
      await removeAvatar();
      await refreshUser();
    } catch (err) {
      setAvatarError(err instanceof AuthError ? err.message : "Couldn't remove photo. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setPasswordMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: "error", text: "Please fill in all three password fields." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    setPasswordSaving(true);
    try {
      const message = await changePassword(currentPassword, newPassword);
      setPasswordMessage({ type: "success", text: message });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({ type: "error", text: err instanceof AuthError ? err.message : "Couldn't reach the server. Please try again." });
    } finally {
      setPasswordSaving(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
    autoComplete?: string
  ) => (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="input-field w-full px-3 py-2.5 text-sm"
      />
    </div>
  );

  const displayRole = user?.role === "admin" ? "Administrator" : "Employee";

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Account</p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Profile</h1>
      </div>

      <Card className="p-6 mb-5">
        <div className="flex items-center gap-4">
          <Avatar name={name || user?.name || "?"} src={user?.avatar_url} size={64} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{user?.name}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {displayRole}{department ? ` · ${department}` : ""}
            </p>
            <div className="flex gap-2 mt-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <Button variant="secondary" size="sm" type="button" onClick={handlePhotoClick} disabled={avatarUploading}>
                {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : "Upload photo"}
              </Button>
              {user?.avatar_url && (
                <Button variant="ghost" size="sm" type="button" onClick={handleRemovePhoto} disabled={avatarUploading}>
                  Remove
                </Button>
              )}
            </div>
            {avatarError && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "var(--danger)" }}>
                <XCircle size={12} /> {avatarError}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Personal information
        </p>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Full name", name, setName)}
          {field("Email", email, setEmail, "email")}
          {field("Phone (optional)", phone, setPhone)}
          {field("Department", department, setDepartment)}

          {profileError && (
            <p className="sm:col-span-2 text-xs flex items-center gap-1" style={{ color: "var(--danger)" }}>
              <XCircle size={12} /> {profileError}
            </p>
          )}

          <div className="sm:col-span-2 flex items-center gap-3 mt-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : "Save changes"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleCancel}>Cancel</Button>
            {saved && (
              <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: "var(--success)" }}>
                <CheckCircle2 size={14} /> Saved
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-6 mt-5">
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Change password
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Current password", currentPassword, setCurrentPassword, "password", "current-password")}
          <div />
          {field("New password", newPassword, setNewPassword, "password", "new-password")}
          {field("Confirm new password", confirmPassword, setConfirmPassword, "password", "new-password")}
        </div>
        {passwordMessage && (
          <p
            className="text-xs mt-3 flex items-center gap-1.5"
            style={{ color: passwordMessage.type === "success" ? "var(--success)" : "var(--danger)" }}
          >
            {passwordMessage.type === "success" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {passwordMessage.text}
          </p>
        )}
        <Button type="button" className="mt-4" onClick={handlePasswordUpdate} disabled={passwordSaving}>
          {passwordSaving ? <Loader2 size={15} className="animate-spin" /> : "Update password"}
        </Button>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfilePageContent />
    </RequireAuth>
  );
}
