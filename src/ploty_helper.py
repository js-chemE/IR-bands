import textwrap

def wrap_for_hover(text: str, width: int = 50) -> str:
    """Wrap a long string into lines for Plotly hover tooltips.
    
    Plotly hover labels don't auto-wrap, so we insert <br> tags manually.
    Each input line (split on existing newlines) is wrapped independently
    so existing line breaks are preserved.
    """
    if not text:
        return text
    wrapped_lines = []
    for line in text.split("\n"):
        if line.strip():
            wrapped = textwrap.fill(line, width=width, break_long_words=False)
            wrapped_lines.append(wrapped.replace("\n", "<br>"))
        else:
            wrapped_lines.append("")
    return "<br>".join(wrapped_lines)