#Requires AutoHotkey v2.0

SUB_FOLDER    := "C:\Users\비전아동센터\Desktop\iCloudDrive\서브일정사진"
OUTPUT_FOLDER := "C:\Users\비전아동센터\Desktop\세부일정정리 아이클라우드"

COMPLETE_VARIANTS := ["완료", "완로", "왕료", "왕로", "안료", "원료", "완뇨"]

; 일정 내용에 이 단어가 있으면 제목 맨 앞에 @@ 를 붙인다
SAVE_MARK := "@@"
SAVE_WORD := "저장"

TYPO_FIX := Map(
    "서유철","서류철", "서로철","서류철", "서료철","서류철", "서루철","서류철",
    "상금자보고","상급자보고", "상긴자보고","상급자보고", "상근자보고","상급자보고",
    "휘망이음","희망이음", "히망이음","희망이음", "회망이음","희망이음",
    "평까서","평가서", "펴가서","평가서",
    "인쇠","인쇄", "인새","인쇄",
    "이 메일","이메일", "이매일","이메일",
    "게획서","계획서", "게획안","기획안",
    "훤류쓰기","환류쓰기", "훤류","환류",
    "쳬크","체크", "쳑크","체크",
    "운녕일지","운영일지",
    "출썩부","출석부",
    "안네문","안내문",
    "동이서","동의서",
    "자언봉사","자원봉사",
    "안전정검","안전점검",
    "사래회의","사례회의",
    "아동가드","아동카드",
    "프린드","프린트", "프리트","프린트",
    "정삼","정산",
    "결제문","결재문",
    "휘계","회계",
    "후언","후원",
    "간싀","간식",
    "식딴","식단",
    "겸학","견학",
    "학습지또","학습지도",
    "프로그렘","프로그램",
    "홯동일지","활동일지",
    "신청써","신청서",
    "회이록","회의록",
    "명딴","명단",
    "종겨서","종결서"
)

Main()

Main() {
    global SUB_FOLDER, OUTPUT_FOLDER
    today := SubStr(A_Now, 1, 8)

    if (!DirExist(SUB_FOLDER)) {
        MsgBox("서브일정사진 폴더 없음:`n" SUB_FOLDER, "오류")
        ExitApp
    }
    allFiles := ScanImages(SUB_FOLDER)
    if (allFiles.Length = 0) {
        MsgBox("이미지 없음", "결과")
        ExitApp
    }

    fileInfos := []
    todayCount := 0
    for f in allFiles {
        cleanName := ApplyTypoFix(Clean(BaseName(f.name)))
        completed := DetectCompleted(cleanName)
        cleaned := RemoveCompleteVariants(cleanName)
        info := {
            cleaned: cleaned,
            completed: completed,
            modTime: f.modTime,
            dateSig: ExtractDate(cleaned),
            keywords: ExtractKeywords(cleaned),
            firstWord: GetFirstWord(cleaned),
            isToday: SubStr(f.modTime, 1, 8) = today
        }
        fileInfos.Push(info)
        if (info.isToday)
            todayCount++
    }

    groups := ClusterFiles(fileInfos)

    try {
        path := BuildReport(groups, today, todayCount)
        MsgBox("자동 저장 완료`n`n" path, "성공")
    } catch as e {
        MsgBox("Word 실패: " e.Message, "오류")
    }
}

ScanImages(folder) {
    r := []
    Loop Files, folder "\*.*" {
        e := StrLower(A_LoopFileExt)
        if (e = "jpg" || e = "jpeg" || e = "png" || e = "heic"
            || e = "gif" || e = "bmp" || e = "webp")
            r.Push({name: A_LoopFileName, modTime: A_LoopFileTimeModified})
    }
    return r
}

; ═══════════════════════════════════════════════
; 유틸
; ═══════════════════════════════════════════════
NoSpc(s) => RegExReplace(s, "\s+", "")
NormalizeKey(s) => RegExReplace(s, "\s+", "")
FullDate(t) => SubStr(t, 1, 4) "년 " (SubStr(t, 5, 2) + 0) "월 " (SubStr(t, 7, 2) + 0) "일"
RGB(r, g, b) => r + g * 256 + b * 65536

Clean(s) {
    s := Trim(RegExReplace(s, "\s+", " "))
    s := RegExReplace(s, "[\s._]+$", "")
    s := RegExReplace(s, "^[\s._]+", "")
    return s
}

BaseName(s) {
    p := 0
    Loop StrLen(s) {
        if (SubStr(s, A_Index, 1) = ".")
            p := A_Index
    }
    return p = 0 ? s : SubStr(s, 1, p - 1)
}

ApplyTypoFix(s) {
    global TYPO_FIX
    for bad, good in TYPO_FIX
        s := StrReplace(s, bad, good)
    return s
}

BuildFlexiblePattern(word) {
    result := ""
    Loop Parse, word {
        if (A_Index > 1)
            result .= "\s*"
        result .= A_LoopField
    }
    return result
}

DetectCompleted(s) {
    global COMPLETE_VARIANTS
    flat := NoSpc(s)
    if (InStr(flat, "복사본완료") > 0)
        return true
    for cv in COMPLETE_VARIANTS {
        if (InStr(flat, cv) > 0)
            return true
    }
    return false
}

RemoveCompleteVariants(s) {
    global COMPLETE_VARIANTS
    for cv in COMPLETE_VARIANTS {
        pattern := BuildFlexiblePattern(cv)
        s := RegExReplace(s, pattern, " ")
    }
    s := RegExReplace(s, BuildFlexiblePattern("복사본"), " ")
    return Trim(RegExReplace(s, "\s+", " "))
}

; ═══════════════════════════════════════════════
; "저장" 표시 (@@)
; ═══════════════════════════════════════════════
HasSaveWord(s) {
    global SAVE_WORD
    return InStr(NoSpc(s), SAVE_WORD) > 0
}

MarkSave(s) {
    global SAVE_MARK
    if (SubStr(Trim(s), 1, StrLen(SAVE_MARK)) = SAVE_MARK)
        return s
    return HasSaveWord(s) ? SAVE_MARK " " s : s
}

; 상위 일정 제목 자체 또는 세부 항목 중 하나라도 "저장"이 있으면 제목 앞에 @@
GroupTitle(g) {
    global SAVE_MARK
    if (HasSaveWord(g.display))
        return MarkSave(g.display)
    for k, s in g.subtasks {
        if (HasSaveWord(s.display))
            return SAVE_MARK " " g.display
    }
    return g.display
}

; ═══════════════════════════════════════════════
; 날짜, 키워드, 첫 단어
; ═══════════════════════════════════════════════
ExtractDate(name) {
    if (RegExMatch(name, "(\d{4})", &m))
        return m[1]
    if (RegExMatch(name, "(\d{2})[-_](\d{2})", &m))
        return m[1] . m[2]
    return ""
}

ExtractKeywords(name) {
    global COMPLETE_VARIANTS
    working := name
    working := RegExReplace(working, "\d{2}[-_]\d{2}", " ")
    working := RegExReplace(working, "\d+", " ")
    for cv in COMPLETE_VARIANTS
        working := StrReplace(working, cv, " ")
    working := StrReplace(working, "복사본", " ")
    working := RegExReplace(working, "[_\-.:/(),]", " ")
    working := Trim(RegExReplace(working, "\s+", " "))
    words := []
    for w in StrSplit(working, " ") {
        w := Trim(w)
        if (StrLen(w) >= 2)
            words.Push(w)
    }
    return words
}

GetFirstWord(name) {
    cleaned := RegExReplace(name, "[,.:/()\-_]", " ")
    for w in StrSplit(cleaned, " ") {
        w := Trim(w)
        if (w = "")
            continue
        if (RegExMatch(w, "^\d+$"))
            continue
        if (StrLen(w) < 2)
            continue
        return w
    }
    return ""
}

KeywordSimilar(a, b) {
    if (a = b)
        return true
    if (StrLen(a) >= 2 && StrLen(b) >= 2) {
        if (InStr(a, b) || InStr(b, a))
            return true
    }
    return false
}

CountSharedKeywords(kw1, kw2) {
    count := 0
    seenB := Map()
    for k1 in kw1 {
        for i, k2 in kw2 {
            if (seenB.Has(i))
                continue
            if (KeywordSimilar(k1, k2)) {
                count++
                seenB[i] := true
                break
            }
        }
    }
    return count
}

IsDateClose(t1, t2, days := 2) {
    try {
        diff := DateDiff(t1, t2, "D")
        return Abs(diff) <= days
    } catch {
        return false
    }
}

; ═══════════════════════════════════════════════
; 점수 기반 매칭
; ═══════════════════════════════════════════════
ScorePair(a, b) {
    score := 0

    if (a.dateSig != "" && b.dateSig != "") {
        if (a.dateSig = b.dateSig) {
            score += 15
        } else {
            if (!IsDateClose(a.modTime, b.modTime, 2))
                return 0
        }
    }

    if (a.firstWord != "" && b.firstWord != "" && a.firstWord = b.firstWord)
        score += 20

    sharedCount := CountSharedKeywords(a.keywords, b.keywords)
    score += sharedCount * 10

    if (IsDateClose(a.modTime, b.modTime, 2))
        score += 5

    return score
}

ClusterFiles(fileInfos) {
    n := fileInfos.Length
    if (n = 0)
        return Map()

    parent := []
    Loop n
        parent.Push(A_Index)

    THRESHOLD := 40
    Loop n - 1 {
        i := A_Index
        Loop n - i {
            j := i + A_Index
            score := ScorePair(fileInfos[i], fileInfos[j])
            if (score >= THRESHOLD)
                UnionFind(parent, i, j)
        }
    }

    componentMap := Map()
    Loop n {
        i := A_Index
        r := FindRoot(parent, i)
        rk := "" r
        if (!componentMap.Has(rk))
            componentMap[rk] := []
        componentMap[rk].Push(fileInfos[i])
    }

    groups := Map()
    for rootKey, files in componentMap {
        canonical := files[1]
        pkey := NormalizeKey(canonical.cleaned)
        groups[pkey] := {
            display: canonical.cleaned,
            dateSignature: canonical.dateSig,
            keywords: canonical.keywords,
            firstWord: canonical.firstWord,
            creationTime: canonical.modTime,
            subtasks: Map()
        }
        for f in files {
            subKey := NormalizeKey(f.cleaned)
            if (groups[pkey].subtasks.Has(subKey)) {
                if (f.completed)
                    groups[pkey].subtasks[subKey].completed := true
                if (f.modTime > groups[pkey].subtasks[subKey].modTime)
                    groups[pkey].subtasks[subKey].modTime := f.modTime
            } else {
                groups[pkey].subtasks[subKey] := {
                    display: f.cleaned,
                    completed: f.completed,
                    modTime: f.modTime
                }
            }
        }
    }
    return groups
}

UnionFind(parent, i, j) {
    ri := FindRoot(parent, i)
    rj := FindRoot(parent, j)
    if (ri != rj)
        parent[ri] := rj
}

FindRoot(parent, i) {
    while (parent[i] != i)
        i := parent[i]
    return i
}

; ═══════════════════════════════════════════════
; 진행률
; ═══════════════════════════════════════════════
GroupProgress(g) {
    total := g.subtasks.Count
    done := 0
    for k, s in g.subtasks {
        if (s.completed)
            done++
    }
    return {total: total, done: done, pct: total > 0 ? Round(done / total * 100) : 0}
}

BuildHeader(display, p) {
    return "▶ " display "      진행률 " p.pct "%   (완료 " p.done " / 전체 " p.total ")"
}

; ═══════════════════════════════════════════════
; Word 리포트
; ═══════════════════════════════════════════════
BuildReport(groups, today, todayCount) {
    global OUTPUT_FOLDER
    word := ComObject("Word.Application")
    word.DisplayAlerts := 0
    word.Visible := false
    doc := word.Documents.Add()
    sel := word.Selection
    sel.Font.Name := "맑은 고딕"

    todayFmt := FullDate(today "000000")
    dateFilename := SubStr(today, 1, 4) "-" SubStr(today, 5, 2) "-" SubStr(today, 7, 2)

    sel.ParagraphFormat.Alignment := 1
    sel.Font.Size := 26
    sel.Font.Bold := true
    sel.TypeText(todayFmt "   일정 진행 리포트")
    sel.TypeParagraph()

    sel.Font.Size := 10
    sel.Font.Bold := false
    sel.Font.Color := RGB(90, 90, 90)
    sel.TypeText("작성 " FormatTime(A_Now, "HH:mm") "    |    상위 일정 " groups.Count "개    |    오늘 등록 " todayCount "장")
    sel.TypeParagraph()
    sel.Font.Color := 0
    sel.ParagraphFormat.Alignment := 0
    sel.TypeParagraph()

    try {
        sel.InsertBreak(3)
        lastSec := doc.Sections.Item(doc.Sections.Count)
        tc := lastSec.PageSetup.TextColumns
        tc.SetCount(2)
        try tc.Spacing := 24
    } catch as e {
        MsgBox("2단 설정 실패`n" e.Message, "알림")
    }

    ; [ 1 ] 진행 상황 (전체)  →  [ 2 ] 미완료 항목  →  [ 3 ] 오늘 등록된 일
    WriteAllSection(doc, sel, groups)
    WriteIncompleteSection(doc, sel, groups)
    WriteTodaySection(doc, sel, groups, today)

    path := OUTPUT_FOLDER "\세부항목일정_" dateFilename ".docx"
    doc.SaveAs(path, 12)
    doc.Saved := true
    word.Visible := true
    return path
}

WriteSectionHeader(sel, title) {
    sel.EndKey(6, 0)
    sel.Font.Size := 15
    sel.Font.Bold := true
    sel.Font.Color := RGB(46, 117, 182)
    sel.TypeText(title)
    sel.TypeParagraph()

    sel.Font.Size := 10
    sel.Font.Bold := false
    sel.Font.Color := RGB(46, 117, 182)
    sel.TypeText("──────────────────────────")
    sel.TypeParagraph()
    sel.Font.Color := 0
}

InsertGroupTable(doc, sel, headerText, items) {
    sel.EndKey(6, 0)
    numRows := 1 + items.Length
    tbl := doc.Tables.Add(sel.Range, numRows, 1)
    tbl.Borders.Enable := true

    hc := tbl.Cell(1, 1)
    hcR := hc.Range
    hcR.Text := headerText
    hcR := hc.Range
    hcR.Font.Name := "맑은 고딕"
    hcR.Font.Bold := true
    hcR.Font.Size := 11
    hcR.Font.Color := 0

    for i, item in items {
        c := tbl.Cell(i + 1, 1)
        cR := c.Range
        cR.Text := item.mark "  " item.text
        cR := c.Range
        cR.Font.Name := "맑은 고딕"
        cR.Font.Bold := false
        cR.Font.Size := 10
        if (item.mark = "☑")
            cR.Font.Color := RGB(140, 140, 140)
        else
            cR.Font.Color := 0
    }
    sel.EndKey(6, 0)
}

; ═══════════════════════════════════════════════
; Section 1 — 진행 상황 (전체) : 미완료는 표, 완료는 텍스트
; ═══════════════════════════════════════════════
WriteAllSection(doc, sel, groups) {
    WriteSectionHeader(sel, "[ 1 ]  진행 상황 (전체)")

    incompleteList := []
    completeList := []
    for pkey, grp in groups {
        p := GroupProgress(grp)
        if (p.pct >= 100)
            completeList.Push(grp)
        else
            incompleteList.Push(grp)
    }

    for grp in incompleteList {
        p := GroupProgress(grp)
        headerText := BuildHeader(GroupTitle(grp), p)
        items := []
        for skey, s in grp.subtasks {
            if (!s.completed)
                items.Push({mark: "☐", text: MarkSave(s.display)})
        }
        for skey, s in grp.subtasks {
            if (s.completed)
                items.Push({mark: "☑", text: MarkSave(s.display)})
        }
        InsertGroupTable(doc, sel, headerText, items)
        sel.TypeParagraph()
    }

    if (completeList.Length > 0) {
        sel.EndKey(6, 0)
        sel.Font.Size := 12
        sel.Font.Bold := true
        sel.Font.Color := RGB(100, 100, 100)
        sel.TypeText("── 완료된 일정 (" completeList.Length "개) ──")
        sel.TypeParagraph()
        sel.Font.Bold := false
        sel.Font.Color := 0

        for grp in completeList {
            p := GroupProgress(grp)

            sel.EndKey(6, 0)
            sel.Font.Size := 12
            sel.Font.Bold := true
            sel.Font.Color := RGB(90, 90, 90)
            sel.TypeText("▶ " GroupTitle(grp) "   (완료 " p.done " / 전체 " p.total ")")
            sel.TypeParagraph()
            sel.Font.Bold := false

            for skey, s in grp.subtasks {
                sel.EndKey(6, 0)
                sel.Font.Size := 11
                sel.Font.Bold := false
                sel.Font.Color := RGB(140, 140, 140)
                sel.TypeText("   ☑  " MarkSave(s.display))
                sel.TypeParagraph()
            }

            sel.EndKey(6, 0)
            sel.Font.Color := 0
            sel.TypeParagraph()
        }
    }
    sel.TypeParagraph()
}

; ═══════════════════════════════════════════════
; Section 2 — 미완료 항목
; ═══════════════════════════════════════════════
WriteIncompleteSection(doc, sel, groups) {
    WriteSectionHeader(sel, "[ 2 ]  미완료 항목")

    hasAny := false
    for pkey, grp in groups {
        incompSubs := []
        for skey, s in grp.subtasks {
            if (!s.completed)
                incompSubs.Push(s)
        }
        if (incompSubs.Length = 0)
            continue
        hasAny := true
        p := GroupProgress(grp)
        headerText := BuildHeader(GroupTitle(grp), p)
        items := []
        for s in incompSubs
            items.Push({mark: "☐", text: MarkSave(s.display)})
        InsertGroupTable(doc, sel, headerText, items)
        sel.TypeParagraph()
    }

    if (!hasAny) {
        sel.EndKey(6, 0)
        sel.Font.Size := 12
        sel.Font.Bold := true
        sel.TypeText("   모두 완료됨")
        sel.TypeParagraph()
    }
    sel.TypeParagraph()
}

; ═══════════════════════════════════════════════
; Section 3 — 오늘 등록된 일
; ═══════════════════════════════════════════════
WriteTodaySection(doc, sel, groups, today) {
    WriteSectionHeader(sel, "[ 3 ]  오늘 등록된 일")

    todayParents := []
    for pkey, grp in groups {
        todaySubs := []
        for skey, s in grp.subtasks {
            if (SubStr(s.modTime, 1, 8) = today)
                todaySubs.Push(s)
        }
        if (todaySubs.Length > 0)
            todayParents.Push({grp: grp, todaySubs: todaySubs})
    }

    if (todayParents.Length = 0) {
        sel.EndKey(6, 0)
        sel.Font.Size := 11
        sel.Font.Italic := true
        sel.Font.Color := RGB(120, 120, 120)
        sel.TypeText("   오늘 등록된 사진 없음")
        sel.TypeParagraph()
        sel.Font.Italic := false
        sel.Font.Color := 0
        sel.TypeParagraph()
        sel.TypeParagraph()
        return
    }

    for tp in todayParents {
        p := GroupProgress(tp.grp)
        headerText := BuildHeader(GroupTitle(tp.grp), p)
        items := []
        for s in tp.todaySubs {
            if (!s.completed)
                items.Push({mark: "☐", text: MarkSave(s.display)})
        }
        for s in tp.todaySubs {
            if (s.completed)
                items.Push({mark: "☑", text: MarkSave(s.display)})
        }
        InsertGroupTable(doc, sel, headerText, items)
        sel.TypeParagraph()
    }
    sel.TypeParagraph()
}
