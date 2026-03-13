-- Phase 2: New enum types + extend existing enums
-- Supports: rich role attributes, worksheet pipeline, media requests,
--           presentations, sessions

-- ============================================================
-- NEW ENUM TYPES
-- ============================================================

-- Role type for casting roles (Principal, Background, etc.)
create type public.role_type as enum (
  'principal',
  'background',
  'extra',
  'stand_in',
  'stunt',
  'voice_over',
  'model',
  'dancer',
  'other'
);

-- Per-role union requirement (distinct from talent's personal membership)
create type public.union_status as enum (
  'sag_aftra',
  'sag_aftra_eligible',
  'aea',
  'non_union',
  'any',
  'fi_core'
);

-- Worksheet pipeline status (CD-facing booking pipeline)
create type public.worksheet_status as enum (
  'under_consideration',
  'pinned',
  'on_avail',
  'on_hold',
  'backup',
  'booked',
  'released'
);

-- Media request lifecycle
create type public.media_request_status as enum (
  'draft',
  'sent',
  'closed'
);

-- Per-talent response to a media request
create type public.media_response_status as enum (
  'not_sent',
  'pending',
  'confirmed',
  'declined',
  'received'
);

-- Presentation type
create type public.presentation_type as enum (
  'live',
  'custom'
);

-- Session source
create type public.session_source as enum (
  'media_request',
  'manual'
);

-- ============================================================
-- EXTEND EXISTING ENUMS
-- ============================================================
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- Supabase migrations run each file as a single transaction by default,
-- but ADD VALUE is handled specially by PostgreSQL — it commits immediately.

-- Extend application_status with booking-pipeline states
alter type public.application_status add value if not exists 'on_avail';
alter type public.application_status add value if not exists 'released';

-- Extend media_category for self-tape submissions
alter type public.media_category add value if not exists 'self_tape';
