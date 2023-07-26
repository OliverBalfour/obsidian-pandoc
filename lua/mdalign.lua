-- A filter that fixes obsidian-style align within $$

if FORMAT:match 'latex' or FORMAT:match 'pdf' then
	-- promote aligned elements to raw inline
	function Math(elem)
		if string.find(elem.text, "\\begin{align}") then
			return pandoc.RawInline('latex', elem.text)
		else
			return elem
		end
		
	end
else
	-- do not double nest math versions
	function Math(elem)
		if string.find(elem.text, "\\begin{align}") then
			elem.mathtype = "DisplayMath"
			elem.text = string.gsub(elem.text, "align%*", "aligned")
			elem.text = string.gsub(elem.text, "align", "aligned")
			print(elem.text)
		end
		return elem
	end
end
