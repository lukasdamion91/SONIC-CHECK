"""PDF originality report generation — reportlab, timestamped + SHA-256 integrity hash."""
import io
import json
import hashlib
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

CHARCOAL = colors.HexColor("#1C1C22")
COBALT = colors.HexColor("#0047FF")
LIME = colors.HexColor("#8CB000")
GREY = colors.HexColor("#6B6B75")
LIGHT = colors.HexColor("#F4F1E8")

VERDICT_COLORS = {"CLEAR": colors.HexColor("#1F8A4C"), "REVIEW": colors.HexColor("#B8860B"), "VIOLATION": colors.HexColor("#C0221F")}

S_TITLE = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=24, textColor=CHARCOAL, leading=28)
S_BRAND = ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=11, textColor=COBALT, letterSpacing=2)
S_LABEL = ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=7, textColor=GREY, leading=10)
S_BODY = ParagraphStyle("body", fontName="Helvetica", fontSize=9, textColor=CHARCOAL, leading=13)
S_SMALL = ParagraphStyle("small", fontName="Helvetica", fontSize=7.5, textColor=GREY, leading=10)
S_H2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, textColor=CHARCOAL, leading=16, spaceBefore=6)
S_SCORE = ParagraphStyle("score", fontName="Helvetica-Bold", fontSize=34, textColor=CHARCOAL, leading=38)


def _verdict_para(verdict: str) -> Paragraph:
    c = VERDICT_COLORS.get(verdict, GREY)
    return Paragraph(f'<font color="#{c.hexval()[2:]}"><b>{verdict}</b></font>', ParagraphStyle("v", fontName="Helvetica-Bold", fontSize=14, leading=18))


def build_pdf(scan: dict, user: dict) -> tuple[bytes, str]:
    """Returns (pdf_bytes, integrity_hash)."""
    result = scan.get("result") or {}
    generated_at = datetime.now(timezone.utc)
    integrity_payload = json.dumps({"scan_id": scan.get("id"), "result": result, "generated_at": generated_at.isoformat()}, sort_keys=True, default=str)
    integrity_hash = hashlib.sha256(integrity_payload.encode("utf-8")).hexdigest()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"SonicCheck Report — {scan.get('title', '')}")
    story = []

    # Header
    story.append(Paragraph("SONICCHECK · ORIGINALITY REPORT", S_BRAND))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=2, color=CHARCOAL))
    story.append(Spacer(1, 10))
    story.append(Paragraph(scan.get("title") or "Untitled", S_TITLE))
    story.append(Spacer(1, 2))
    story.append(Paragraph(f"Artist: {scan.get('artist_name') or '—'} · Scanned for: {user.get('name', '')} &lt;{user.get('email', '')}&gt;", S_BODY))
    story.append(Paragraph(f"Scan ID: {scan.get('id', '—')} · Scan date: {scan.get('created_at', '—')}", S_SMALL))
    story.append(Spacer(1, 14))

    # Verdict + score block
    verdict = result.get("verdict", "REVIEW")
    score_tbl = Table([
        [Paragraph("OVERALL PLAGIARISM SCORE", S_LABEL), Paragraph("VERDICT", S_LABEL), Paragraph("LYRIC SIMILARITY", S_LABEL), Paragraph("MELODIC SIMILARITY", S_LABEL)],
        [Paragraph(f"{result.get('overall_score', 0)}%", S_SCORE), _verdict_para(verdict),
         Paragraph(f"{result.get('top_lyric_similarity', 0)}% <font size=7 color=grey>(limit {result.get('lyric_threshold', '—')}%)</font>", S_H2),
         Paragraph(f"{result.get('top_melody_similarity', 0)}% <font size=7 color=grey>(limit {result.get('melody_threshold', '—')}%)</font>", S_H2)],
    ], colWidths=[48 * mm, 38 * mm, 44 * mm, 44 * mm])
    score_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(score_tbl)
    story.append(Spacer(1, 14))

    # Jurisdiction
    story.append(Paragraph("Jurisdiction &amp; Regulatory Assessment", S_H2))
    story.append(Spacer(1, 4))
    juri_rows = [
        [Paragraph("REGION", S_LABEL), Paragraph("DOCTRINE", S_LABEL), Paragraph("LYRIC VERDICT", S_LABEL), Paragraph("MELODY VERDICT", S_LABEL)],
        [Paragraph(f"{result.get('region_name', '—')} ({result.get('region', '—')})", S_BODY),
         Paragraph(result.get("doctrine", "—"), S_BODY),
         Paragraph(result.get("lyric_verdict", "—"), S_BODY),
         Paragraph(result.get("melody_verdict", "—"), S_BODY)],
    ]
    juri_tbl = Table(juri_rows, colWidths=[48 * mm, 42 * mm, 42 * mm, 42 * mm])
    juri_tbl.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GREY),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(juri_tbl)
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Legal context: {result.get('regional_notes', '—')}", S_SMALL))
    story.append(Spacer(1, 14))

    # Fingerprint engine
    fp = result.get("fingerprint")
    if fp:
        story.append(Paragraph(f"Audio Fingerprint Analysis — {fp.get('engine', '—')}", S_H2))
        story.append(Spacer(1, 4))
        if fp.get("matches"):
            rows = [[Paragraph("TITLE", S_LABEL), Paragraph("ARTIST", S_LABEL), Paragraph("SOURCE / ID", S_LABEL), Paragraph("MATCH", S_LABEL)]]
            for t in fp["matches"][:8]:
                ident = t.get("isrc") or (t.get("mbid") or "")[:13] or "—"
                rows.append([Paragraph(t.get("title", "—"), S_BODY), Paragraph(t.get("artist", "—"), S_BODY),
                             Paragraph(f"{t.get('source', '—')} · {ident}", S_SMALL), Paragraph(f"{t.get('confidence', 0)}%", S_BODY)])
            tbl = Table(rows, colWidths=[60 * mm, 50 * mm, 44 * mm, 20 * mm])
            tbl.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, 0), 0.5, GREY), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
            story.append(tbl)
        else:
            story.append(Paragraph(f"Status: {fp.get('status_msg', '—')}. No commercial catalog matches were found for the submitted audio.", S_BODY))
        story.append(Spacer(1, 14))

    # Lyric analysis
    la = result.get("lyric_analysis")
    if la:
        story.append(Paragraph(f"AI Lyric Analysis — {la.get('engine', '—')}", S_H2))
        story.append(Spacer(1, 4))
        if la.get("originality_score") is not None:
            story.append(Paragraph(f"<b>Originality score: {la['originality_score']}%</b> · {la.get('candidates_checked', 0)} reference candidate(s) examined", S_BODY))
            story.append(Spacer(1, 3))
        if la.get("summary"):
            story.append(Paragraph(la["summary"], S_BODY))
        elif la.get("error"):
            story.append(Paragraph(f"Analysis unavailable: {la['error']}", S_SMALL))
        story.append(Spacer(1, 14))

    # Reference matches table
    matches = result.get("matches") or []
    story.append(Paragraph(f"Reference Matches ({len(matches)} works examined)", S_H2))
    story.append(Spacer(1, 4))
    if matches:
        rows = [[Paragraph("REFERENCE WORK", S_LABEL), Paragraph("ARTIST / YEAR", S_LABEL), Paragraph("LYRIC", S_LABEL), Paragraph("MELODIC", S_LABEL), Paragraph("CONF.", S_LABEL)]]
        for m in matches[:12]:
            rows.append([
                Paragraph(m.get("reference_title", "—"), S_BODY),
                Paragraph(f"{m.get('reference_artist', '—')} · {m.get('reference_year', '—')}", S_BODY),
                Paragraph(f"{m.get('lyric_similarity', 0)}%", S_BODY),
                Paragraph(f"{m.get('melodic_similarity', 0)}%", S_BODY),
                Paragraph(f"{round((m.get('confidence') or 0) * 100)}%", S_BODY),
            ])
        tbl = Table(rows, colWidths=[58 * mm, 52 * mm, 22 * mm, 22 * mm, 20 * mm])
        tbl.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, 0), 0.5, GREY), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                                 ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
        story.append(tbl)
        # Top match snippets
        top = matches[0]
        if top.get("matched_snippet"):
            story.append(Spacer(1, 6))
            story.append(Paragraph(f"Top match evidence — <b>{top.get('reference_title')}</b>: “{top.get('matched_snippet')}” ↔ your work: “{top.get('your_snippet', '')}”", S_SMALL))
    else:
        story.append(Paragraph("No reference matches were identified. The submitted work appears original against the checked catalogs.", S_BODY))
    story.append(Spacer(1, 18))

    # Footer / attestation
    story.append(HRFlowable(width="100%", thickness=1, color=GREY))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Report generated: {generated_at.strftime('%Y-%m-%d %H:%M:%S UTC')}", S_SMALL))
    story.append(Paragraph(f"Integrity hash (SHA-256): {integrity_hash}", S_SMALL))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "Disclaimer: This report is an automated similarity assessment produced by SonicCheck using open audio fingerprint databases "
        "(AcoustID / MusicBrainz), lyric reference search and AI semantic analysis. It does not constitute legal advice. "
        "Regional thresholds are indicative interpretations of local copyright doctrine; consult a qualified attorney for legal determinations.", S_SMALL))

    doc.build(story)
    return buf.getvalue(), integrity_hash
